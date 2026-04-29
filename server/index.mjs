#!/usr/bin/env node
/**
 * Airgap reference BFF — single-file HTTP server, zero runtime deps.
 *
 * Serves KB sync manifests, signed KB bundles, model metadata, and accepts
 * telemetry events. See server/README.md for the full surface area and the
 * security model.
 *
 * Run: `node server/index.mjs --port 3000 --kb-root ../src/knowledge`
 */

import {createServer} from 'node:http';
import {
  readFileSync,
  writeFileSync,
  appendFileSync,
  existsSync,
  statSync,
  readdirSync,
  mkdirSync,
} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// -------- argv parsing --------
function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.replace(/^--/, '');
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        out[key] = next;
        i++;
      } else {
        out[key] = true;
      }
    }
  }
  return out;
}

const args = parseArgs(process.argv);
const port = parseInt(args.port ?? process.env.PORT ?? '3000', 10);
const kbRoot = resolve(
  __dirname,
  args['kb-root'] ?? process.env.KB_ROOT ?? '../src/knowledge',
);
const kbVersionOverride = args['kb-version'] ?? process.env.KB_VERSION ?? null;
const keypairPath = resolve(
  __dirname,
  args.keypair ?? process.env.KEYPAIR ?? './.keys/ed25519.json',
);
const modelManifestPath = resolve(
  __dirname,
  args['model-manifest'] ?? process.env.MODEL_MANIFEST ?? './model.json',
);
const telemetryLogPath = resolve(
  __dirname,
  args['telemetry-log'] ?? process.env.TELEMETRY_LOG ?? './telemetry.jsonl',
);

// -------- keypair handling --------
function ensureKeypair() {
  if (existsSync(keypairPath)) {
    return JSON.parse(readFileSync(keypairPath, 'utf-8'));
  }
  console.error(`[bff] no keypair at ${keypairPath}, generating ed25519...`);
  mkdirSync(dirname(keypairPath), {recursive: true});
  const {publicKey, privateKey} = crypto.generateKeyPairSync('ed25519');
  const kp = {
    publicKey: publicKey.export({type: 'spki', format: 'pem'}),
    privateKey: privateKey.export({type: 'pkcs8', format: 'pem'}),
    publicKeyBase64: publicKey
      .export({type: 'spki', format: 'der'})
      .toString('base64'),
  };
  writeFileSync(keypairPath, JSON.stringify(kp, null, 2));
  return kp;
}

const keypair = ensureKeypair();
console.log('[bff] public key (paste into airgap.config.json backend.syncPublicKey):');
console.log(`[bff]   ${keypair.publicKeyBase64}`);

function sign(buffer) {
  return crypto
    .sign(null, buffer, crypto.createPrivateKey(keypair.privateKey))
    .toString('base64');
}

// -------- KB manifest construction --------
function computeKbBundle() {
  if (!existsSync(kbRoot)) {
    throw new Error(`kb root not found: ${kbRoot}`);
  }
  const files = readdirSync(kbRoot)
    .filter(f => f.endsWith('.json'))
    .sort();
  const contents = {};
  let latestMtime = 0;
  for (const f of files) {
    const p = join(kbRoot, f);
    const s = statSync(p);
    if (s.mtimeMs > latestMtime) latestMtime = s.mtimeMs;
    contents[f] = readFileSync(p, 'utf-8');
  }
  const bundle = Buffer.from(
    JSON.stringify({files: contents, generatedAt: new Date().toISOString()}),
  );
  const sha256 = crypto.createHash('sha256').update(bundle).digest('hex');
  const version = kbVersionOverride ?? new Date(latestMtime).toISOString();
  const signature = sign(bundle);
  return {bundle, sha256, version, signature, files};
}

let cachedKb = null;
function getKb() {
  if (!cachedKb) cachedKb = computeKbBundle();
  return cachedKb;
}

// -------- model manifest --------
function getModelManifest(hostHeader) {
  if (existsSync(modelManifestPath)) {
    return JSON.parse(readFileSync(modelManifestPath, 'utf-8'));
  }
  // Fallback: ship the canonical Gemma 4 E2B Q3_K_S metadata. The device
  // already has this in its local config; the BFF is authoritative for
  // "what is the current sanctioned version", which may differ from what
  // the client was shipped with.
  return {
    version: '1.0.0',
    filename: 'gemma-4-e2b-it-q3ks.gguf',
    url: 'https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/main/gemma-4-E2B-it-Q3_K_S.gguf',
    sha256:
      '2d010e251ba1fc44b746eb4059825a1954df5f90a1b7a360cf18232a520709aa',
    sizeBytes: 2445645184,
    publishedAt: '2026-03-15T00:00:00Z',
  };
}

// -------- http server --------
function sendJson(res, status, body, extraHeaders = {}) {
  const raw = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(raw),
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  res.end(raw);
}

function sendBytes(res, status, bytes, contentType) {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Content-Length': bytes.length,
    'Cache-Control': 'no-store',
  });
  res.end(bytes);
}

function readBody(req, maxBytes = 256 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', c => {
      total += c.length;
      if (total > maxBytes) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function handle(req, res) {
  // Always reject Origin headers — this BFF is device-facing, not browser.
  if (req.headers.origin) {
    sendJson(res, 403, {error: 'cors not allowed'});
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);

  if (req.method === 'GET' && url.pathname === '/api/v1/sync/kb') {
    try {
      const kb = getKb();
      sendJson(res, 200, {
        version: kb.version,
        sha256: kb.sha256,
        url: `${url.origin}/api/v1/sync/kb/download`,
        publishedAt: new Date().toISOString(),
        signature: kb.signature,
      });
    } catch (err) {
      console.error('[bff] kb manifest failed:', err);
      sendJson(res, 500, {error: 'manifest_failed'});
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/v1/sync/kb/download') {
    try {
      const kb = getKb();
      sendBytes(res, 200, kb.bundle, 'application/json');
    } catch (err) {
      console.error('[bff] kb download failed:', err);
      sendJson(res, 500, {error: 'download_failed'});
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/v1/sync/model') {
    const manifest = getModelManifest(req.headers.host);
    sendJson(res, 200, manifest);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/v1/telemetry') {
    readBody(req)
      .then(buf => {
        const parsed = JSON.parse(buf.toString('utf-8'));
        const events = Array.isArray(parsed?.events) ? parsed.events : [];
        if (events.length === 0) {
          sendJson(res, 400, {error: 'no_events'});
          return;
        }
        mkdirSync(dirname(telemetryLogPath), {recursive: true});
        const lines =
          events
            .map(ev => JSON.stringify({...ev, ingestedAt: new Date().toISOString()}))
            .join('\n') + '\n';
        appendFileSync(telemetryLogPath, lines, 'utf-8');
        sendJson(res, 202, {accepted: events.length});
      })
      .catch(err => {
        console.error('[bff] telemetry parse failed:', err);
        sendJson(res, 400, {error: 'invalid_payload'});
      });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/healthz') {
    sendJson(res, 200, {ok: true, kbVersion: getKb().version});
    return;
  }

  sendJson(res, 404, {error: 'not_found', path: url.pathname});
}

const server = createServer(handle);
server.listen(port, () => {
  console.log(`[bff] listening on http://localhost:${port}`);
  console.log(`[bff] kb root: ${kbRoot}`);
  console.log(`[bff] telemetry log: ${telemetryLogPath}`);
});
