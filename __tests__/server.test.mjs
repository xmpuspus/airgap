import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile, rm} from 'node:fs/promises';
import {createServer} from 'node:net';
import {createHash, createPublicKey, verify} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawn} from 'node:child_process';
import test from 'node:test';

const projectRoot = resolve(import.meta.dirname, '..');
let fixtureRoot;
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

async function waitForServer(url) {
  for (let count = 0; count < 50; count += 1) {
    try {
      const response = await fetch(`${url}/healthz`);
      if (response.ok) return;
    } catch {
      await new Promise(resolveWait => setTimeout(resolveWait, 50));
    }
  }
  throw new Error('server_start_timeout');
}

test.before(async () => {
  fixtureRoot = await mkdtemp(join(tmpdir(), 'airgap-server-test-'));
  const kbRoot = join(fixtureRoot, 'knowledge');
  await mkdir(kbRoot);
  await writeFile(
    join(kbRoot, 'faq.json'),
    JSON.stringify([{id: 'one', title: 'One', content: 'Checked content'}]),
  );
  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  keypairPath = join(fixtureRoot, 'ed25519.json');
  child = spawn(
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
    ],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
        BFF_AUTH_TOKEN: 'test-token-with-enough-entropy',
        BFF_RATE_LIMIT: '5',
        BFF_RATE_WINDOW_MS: '60000',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  await waitForServer(baseUrl);
});

test.after(async () => {
  child?.kill('SIGTERM');
  await rm(fixtureRoot, {recursive: true, force: true});
});

test('keeps the health route public', async () => {
  const response = await fetch(`${baseUrl}/healthz`);
  assert.equal(response.status, 200);
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

test('limits one authorized client after the set request count', async () => {
  const headers = {Authorization: 'Bearer test-token-with-enough-entropy'};
  let response;
  for (let count = 0; count < 10; count += 1) {
    response = await fetch(`${baseUrl}/api/v1/sync/model`, {headers});
    if (response.status === 429) break;
  }
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('retry-after'), '60');
});
