import {createHash, createPrivateKey, createPublicKey, sign} from 'node:crypto';
import {verifyBundle, type BundleVerificationInput} from '../src/services/bundleVerifier';

const seed = Buffer.from('000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f', 'hex');
const privateKey = createPrivateKey({
  key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed]),
  format: 'der',
  type: 'pkcs8',
});
const publicKeyDer = createPublicKey(privateKey).export({
  format: 'der',
  type: 'spki',
});
const publicKey = publicKeyDer.subarray(publicKeyDer.length - 32);
const keyId = createHash('sha256').update(publicKey).digest('hex').slice(0, 16);

function validInput(): BundleVerificationInput {
  const text = JSON.stringify({
    files: {
      'faq.json': JSON.stringify([
        {
          id: 'faq-1',
          category: 'faq',
          title: 'Checked answer',
          content: 'The exact signed document body.',
          keywords: ['checked'],
          tags: [],
          metadata: {},
        },
      ]),
    },
    generatedAt: '2026-08-12T00:00:00.000Z',
  });
  const bytes = new TextEncoder().encode(text);
  return {
    bytes,
    actualSha256: createHash('sha256').update(bytes).digest('hex'),
    manifest: {
      algorithm: 'Ed25519',
      signatureEncoding: 'base64',
      byteLength: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      version: '2',
      keyId,
      url: 'https://bff.example/api/v1/sync/kb/download',
      publishedAt: '2026-08-12T00:00:00.000Z',
      signature: sign(null, bytes, privateKey).toString('base64'),
    },
    publicKeys: {[keyId]: publicKey.toString('base64')},
  };
}

describe('bundle verifier', () => {
  test('accepts the exact signed bytes', async () => {
    await expect(verifyBundle(validInput())).resolves.toMatchObject({
      version: '2',
      text: expect.stringContaining('Checked answer'),
    });
  });

  test('rejects a bad length', async () => {
    const input = validInput();
    input.manifest.byteLength += 1;
    await expect(verifyBundle(input)).rejects.toThrow('bundle_length_invalid');
  });

  test('rejects a bad sha256', async () => {
    const input = validInput();
    input.actualSha256 = '0'.repeat(64);
    await expect(verifyBundle(input)).rejects.toThrow('bundle_sha256_invalid');
  });

  test('rejects a bad signature', async () => {
    const input = validInput();
    input.bytes[0] = input.bytes[0] === 123 ? 124 : 123;
    input.manifest.byteLength = input.bytes.length;
    input.manifest.sha256 = createHash('sha256').update(input.bytes).digest('hex');
    input.actualSha256 = input.manifest.sha256;
    await expect(verifyBundle(input)).rejects.toThrow('bundle_signature_invalid');
  });

  test('rejects an unknown key ID', async () => {
    const input = validInput();
    input.manifest.keyId = 'unknown-key';
    await expect(verifyBundle(input)).rejects.toThrow('bundle_key_invalid');
  });

  test('rejects a bad bundle schema', async () => {
    const input = validInput();
    const bytes = new TextEncoder().encode(JSON.stringify({files: {}}));
    input.bytes = bytes;
    input.manifest.byteLength = bytes.length;
    input.manifest.sha256 = createHash('sha256').update(bytes).digest('hex');
    input.actualSha256 = input.manifest.sha256;
    input.manifest.signature = sign(null, bytes, privateKey).toString('base64');
    await expect(verifyBundle(input)).rejects.toThrow('bundle_schema_invalid');
  });

  test.each([
    ['algorithm', 'RSA'],
    ['signatureEncoding', 'hex'],
  ] as const)('rejects an unsupported %s', async (field, value) => {
    const input = validInput();
    Object.assign(input.manifest, {[field]: value});
    await expect(verifyBundle(input)).rejects.toThrow('bundle_manifest_invalid');
  });
});
