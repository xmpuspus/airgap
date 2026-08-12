import nacl from 'tweetnacl';

/* eslint-disable no-bitwise -- Base64 and UTF-8 decoding operate on bytes. */

export interface BundleManifest {
  algorithm: 'Ed25519';
  signatureEncoding: 'base64';
  byteLength: number;
  sha256: string;
  version: string;
  keyId: string;
  url: string;
  publishedAt: string;
  signature: string;
}

export interface BundleVerificationInput {
  bytes: Uint8Array;
  actualSha256: string;
  manifest: BundleManifest;
  publicKeys: Readonly<Record<string, string>>;
}

export interface VerifiedBundle {
  version: string;
  keyId: string;
  text: string;
  bundle: {
    files: Record<string, string>;
    generatedAt: string;
  };
}

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function decodeBase64(value: string): Uint8Array | null {
  if (
    value.length === 0 ||
    value.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
  ) {
    return null;
  }

  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  const output = new Uint8Array((value.length / 4) * 3 - padding);
  let outputIndex = 0;

  for (let index = 0; index < value.length; index += 4) {
    const first = BASE64_ALPHABET.indexOf(value[index]);
    const second = BASE64_ALPHABET.indexOf(value[index + 1]);
    const third = value[index + 2] === '=' ? 0 : BASE64_ALPHABET.indexOf(value[index + 2]);
    const fourth = value[index + 3] === '=' ? 0 : BASE64_ALPHABET.indexOf(value[index + 3]);
    const group = (first << 18) | (second << 12) | (third << 6) | fourth;

    if (outputIndex < output.length) output[outputIndex++] = group >> 16;
    if (outputIndex < output.length) output[outputIndex++] = (group >> 8) & 0xff;
    if (outputIndex < output.length) output[outputIndex++] = group & 0xff;
  }

  return output;
}

export function encodeBase64Bytes(bytes: Uint8Array): string {
  let output = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = bytes[index + 1] ?? 0;
    const third = bytes[index + 2] ?? 0;
    const group = (first << 16) | (second << 8) | third;

    output += BASE64_ALPHABET[(group >> 18) & 0x3f];
    output += BASE64_ALPHABET[(group >> 12) & 0x3f];
    output += index + 1 < bytes.length ? BASE64_ALPHABET[(group >> 6) & 0x3f] : '=';
    output += index + 2 < bytes.length ? BASE64_ALPHABET[group & 0x3f] : '=';
  }
  return output;
}

function decodeUtf8(bytes: Uint8Array): string {
  let result = '';
  for (let index = 0; index < bytes.length; ) {
    const first = bytes[index++];
    let codePoint = first;
    let continuationCount = 0;
    let minimum = 0;

    if (first >= 0xc2 && first <= 0xdf) {
      codePoint = first & 0x1f;
      continuationCount = 1;
      minimum = 0x80;
    } else if (first >= 0xe0 && first <= 0xef) {
      codePoint = first & 0x0f;
      continuationCount = 2;
      minimum = 0x800;
    } else if (first >= 0xf0 && first <= 0xf4) {
      codePoint = first & 0x07;
      continuationCount = 3;
      minimum = 0x10000;
    } else if (first > 0x7f) {
      throw new Error('bundle_schema_invalid');
    }

    for (let offset = 0; offset < continuationCount; offset += 1) {
      const next = bytes[index++];
      if (next === undefined || (next & 0xc0) !== 0x80) {
        throw new Error('bundle_schema_invalid');
      }
      codePoint = (codePoint << 6) | (next & 0x3f);
    }

    if (
      codePoint < minimum ||
      codePoint > 0x10ffff ||
      (codePoint >= 0xd800 && codePoint <= 0xdfff)
    ) {
      throw new Error('bundle_schema_invalid');
    }
    result += String.fromCodePoint(codePoint);
  }
  return result;
}

function parseBundle(text: string): VerifiedBundle['bundle'] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('bundle_schema_invalid');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('bundle_schema_invalid');
  }
  const candidate = parsed as {files?: unknown; generatedAt?: unknown};
  if (
    !candidate.files ||
    typeof candidate.files !== 'object' ||
    Array.isArray(candidate.files) ||
    typeof candidate.generatedAt !== 'string' ||
    !Number.isFinite(Date.parse(candidate.generatedAt))
  ) {
    throw new Error('bundle_schema_invalid');
  }

  const files = candidate.files as Record<string, unknown>;
  let documentCount = 0;
  for (const [filename, fileText] of Object.entries(files)) {
    if (!filename.endsWith('.json') || typeof fileText !== 'string') {
      throw new Error('bundle_schema_invalid');
    }
    let documents: unknown;
    try {
      documents = JSON.parse(fileText);
    } catch {
      throw new Error('bundle_schema_invalid');
    }
    if (!Array.isArray(documents)) throw new Error('bundle_schema_invalid');
    for (const document of documents) {
      if (
        !document ||
        typeof document !== 'object' ||
        typeof (document as {id?: unknown}).id !== 'string' ||
        typeof (document as {category?: unknown}).category !== 'string' ||
        typeof (document as {title?: unknown}).title !== 'string' ||
        typeof (document as {content?: unknown}).content !== 'string' ||
        !Array.isArray((document as {keywords?: unknown}).keywords) ||
        !(document as {keywords: unknown[]}).keywords.every(keyword => typeof keyword === 'string')
      ) {
        throw new Error('bundle_schema_invalid');
      }
      documentCount += 1;
    }
  }
  if (documentCount === 0) throw new Error('bundle_schema_invalid');

  return {
    files: files as Record<string, string>,
    generatedAt: candidate.generatedAt,
  };
}

function validateManifest(manifest: BundleManifest): void {
  if (
    manifest.algorithm !== 'Ed25519' ||
    manifest.signatureEncoding !== 'base64' ||
    !Number.isSafeInteger(manifest.byteLength) ||
    manifest.byteLength < 1 ||
    !/^[a-f0-9]{64}$/.test(manifest.sha256) ||
    !manifest.version ||
    !manifest.keyId ||
    !/^https:\/\//.test(manifest.url) ||
    !Number.isFinite(Date.parse(manifest.publishedAt))
  ) {
    throw new Error('bundle_manifest_invalid');
  }
}

export async function verifyBundle(input: BundleVerificationInput): Promise<VerifiedBundle> {
  validateManifest(input.manifest);
  if (input.bytes.length !== input.manifest.byteLength) {
    throw new Error('bundle_length_invalid');
  }
  if (input.actualSha256.toLowerCase() !== input.manifest.sha256) {
    throw new Error('bundle_sha256_invalid');
  }

  const encodedKey = input.publicKeys[input.manifest.keyId];
  const publicKey = encodedKey ? decodeBase64(encodedKey) : null;
  if (!publicKey || publicKey.length !== nacl.sign.publicKeyLength) {
    throw new Error('bundle_key_invalid');
  }

  const signature = decodeBase64(input.manifest.signature);
  if (
    !signature ||
    signature.length !== nacl.sign.signatureLength ||
    !nacl.sign.detached.verify(input.bytes, signature, publicKey)
  ) {
    throw new Error('bundle_signature_invalid');
  }

  const text = decodeUtf8(input.bytes);
  return {
    version: input.manifest.version,
    keyId: input.manifest.keyId,
    text,
    bundle: parseBundle(text),
  };
}
