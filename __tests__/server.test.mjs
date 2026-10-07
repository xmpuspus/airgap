import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile, rm} from 'node:fs/promises';
import {request} from 'node:http';
import {createServer} from 'node:net';
import {createHash, createPublicKey, verify} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import test from 'node:test';
import {takeRateToken} from '../server/index.mjs';

const projectRoot = resolve(import.meta.dirname, '..');
let fixtureRoot;
let kbRoot;
let baseUrl;
let child;
let keypairPath;

async function freePort() {
  return new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      probe.close(() => resolvePort(address.port));
    });
  });
}

// Any HTTP answer means the server is up, even a 503 or a 429.
async function waitForServer(url) {
  for (let count = 0; count < 50; count += 1) {
    try {
      await fetch(`${url}/healthz`);
      return;
    } catch {
      await new Promise(resolveWait => setTimeout(resolveWait, 50));
    }
  }
  throw new Error('server_start_timeout');
}

async function startServer(args = [], env = {}) {
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const server = spawn(
    process.execPath,
    [
      'server/index.mjs',
      '--port',
      String(port),
      '--kb-root',
      kbRoot,
      '--keypair',
      keypairPath,
      '--telemetry-log',
      join(fixtureRoot, 'telemetry.jsonl'),
      ...args,
    ],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
        BFF_AUTH_TOKEN: 'test-token-with-enough-entropy',
        BFF_RATE_LIMIT: '50',
        BFF_RATE_WINDOW_MS: '60000',
        ...env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  await waitForServer(url);
  return {url, server};
}

// fetch() replaces the Host header with the real one, so use node:http.
function statusWithHost(url, path, host) {
  return new Promise((resolveStatus, reject) => {
    const req = request(`${url}${path}`, {headers: {Host: host}}, response => {
      response.resume();
      response.on('end', () => resolveStatus(response.statusCode));
    });
    req.once('error', reject);
    req.end();
  });
}

test.before(async () => {
  fixtureRoot = await mkdtemp(join(tmpdir(), 'airgap-server-test-'));
  kbRoot = join(fixtureRoot, 'knowledge');
  await mkdir(kbRoot);
  await writeFile(
    join(kbRoot, 'faq.json'),
    JSON.stringify([{id: 'one', title: 'One', content: 'Checked content'}]),
  );
  keypairPath = join(fixtureRoot, 'ed25519.json');
  ({url: baseUrl, server: child} = await startServer());
});

test.after(async () => {
  child?.kill('SIGTERM');
  await rm(fixtureRoot, {recursive: true, force: true});
});

test('keeps the health route public', async () => {
  const response = await fetch(`${baseUrl}/healthz`);
  assert.equal(response.status, 200);
});

test('rejects a malformed host header and keeps serving', async t => {
  const {url, server} = await startServer();
  t.after(() => server.kill());
  assert.equal(await statusWithHost(url, '/healthz', 'a b'), 400);
  const response = await fetch(`${url}/healthz`);
  assert.equal(response.status, 200);
});

test('reports a missing knowledge root as unavailable and keeps serving', async t => {
  const {url, server} = await startServer(['--kb-root', join(fixtureRoot, 'missing')]);
  t.after(() => server.kill());
  for (let count = 0; count < 2; count += 1) {
    const response = await fetch(`${url}/healthz`);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {ok: false, error: 'kb_unavailable'});
  }
});

test('rejects a missing bearer token', async () => {
  const response = await fetch(`${baseUrl}/api/v1/sync/kb`);
  assert.equal(response.status, 401);
});

test('accepts a valid bearer token', async () => {
  const response = await fetch(`${baseUrl}/api/v1/sync/kb`, {
    headers: {Authorization: 'Bearer test-token-with-enough-entropy'},
  });
  assert.equal(response.status, 200);
});

test('describes and signs the exact download bytes', async () => {
  const headers = {Authorization: 'Bearer test-token-with-enough-entropy'};
  const manifestResponse = await fetch(`${baseUrl}/api/v1/sync/kb`, {headers});
  const manifest = await manifestResponse.json();
  const downloadResponse = await fetch(manifest.url, {headers});
  const bytes = Buffer.from(await downloadResponse.arrayBuffer());
  const keypair = JSON.parse(await readFile(keypairPath, 'utf8'));
  const publicKey = createPublicKey(keypair.publicKey);
  const rawPublicKey = publicKey.export({format: 'jwk'}).x;
  const rawBytes = Buffer.from(rawPublicKey, 'base64url');

  assert.equal(manifest.algorithm, 'Ed25519');
  assert.equal(manifest.signatureEncoding, 'base64');
  assert.equal(manifest.byteLength, bytes.length);
  assert.equal(manifest.sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.equal(manifest.keyId, createHash('sha256').update(rawBytes).digest('hex').slice(0, 16));
  assert.equal(verify(null, bytes, publicKey, Buffer.from(manifest.signature, 'base64')), true);
});

test('links the bundle through the public URL behind a TLS proxy', async t => {
  const {url, server} = await startServer(['--public-url', 'https://bff.example.com/']);
  t.after(() => server.kill());
  const response = await fetch(`${url}/api/v1/sync/kb`, {
    headers: {Authorization: 'Bearer test-token-with-enough-entropy'},
  });
  const manifest = await response.json();
  assert.equal(manifest.url, 'https://bff.example.com/api/v1/sync/kb/download');
});

test('prints the options for --help without a token', () => {
  const result = spawnSync(process.execPath, ['server/index.mjs', '--help'], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: {...process.env, BFF_AUTH_TOKEN: ''},
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /--public-url <url>/);
  assert.match(result.stdout, /BFF_PUBLIC_URL/);
});

test('limits one authorized client after the set request count', async t => {
  const {url, server} = await startServer([], {BFF_RATE_LIMIT: '5'});
  t.after(() => server.kill());
  const headers = {Authorization: 'Bearer test-token-with-enough-entropy'};
  let response;
  for (let count = 0; count < 10; count += 1) {
    response = await fetch(`${url}/api/v1/sync/model`, {headers});
    if (response.status === 429) break;
  }
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('retry-after'), '60');
});

test('limits unauthenticated and health requests from one client', async t => {
  const {url, server} = await startServer([], {BFF_RATE_LIMIT: '5'});
  t.after(() => server.kill());
  // The startup health check uses the first of the five requests.
  const paths = [
    '/api/v1/sync/kb',
    '/api/v1/sync/kb',
    '/healthz',
    '/healthz',
    '/api/v1/sync/kb',
    '/healthz',
  ];
  const statuses = [];
  for (const path of paths) {
    statuses.push((await fetch(`${url}${path}`)).status);
  }
  assert.deepEqual(statuses, [401, 401, 200, 200, 429, 429]);
});

test('drops rate buckets after their window ends', () => {
  const buckets = new Map();
  takeRateToken('10.0.0.1', buckets, 5, 1000, 0);
  takeRateToken('10.0.0.2', buckets, 5, 1000, 500);
  takeRateToken('10.0.0.3', buckets, 5, 1000, 1000);
  assert.deepEqual([...buckets.keys()], ['10.0.0.2', '10.0.0.3']);
});
