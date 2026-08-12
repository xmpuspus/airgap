const mockManifest = {
  algorithm: 'Ed25519',
  signatureEncoding: 'base64',
  byteLength: 3,
  sha256: 'a'.repeat(64),
  version: '2',
  keyId: '0123456789abcdef',
  url: 'https://bff.example/api/v1/sync/kb/download',
  publishedAt: '2026-08-12T00:00:00.000Z',
  signature: 'signature',
};
const mockFetchKbManifest = jest.fn(async () => mockManifest);
const mockFetchKbBytes = jest.fn(async () => Uint8Array.from([1, 2, 3]));
const mockVerifyBundle = jest.fn(async (_input: unknown) => {
  throw new Error('bundle_signature_invalid');
});
jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/tmp/airgap-sync-test',
  exists: jest.fn(async (path: string) => path.endsWith('/kb')),
  mkdir: jest.fn(async () => undefined),
  writeFile: jest.fn(async () => undefined),
  hash: jest.fn(async () => mockManifest.sha256),
  moveFile: jest.fn(async () => undefined),
  unlink: jest.fn(async () => undefined),
  readFile: jest.fn(async () => ''),
}));
jest.mock('react-native-mmkv', () => require('./helpers/rn-mocks').rnMmkv());
jest.mock('../src/services/secureStorage', () => require('./helpers/rn-mocks').secureStorage());
jest.mock('../src/services/connectivityService', () => ({
  connectivityService: {
    isOnline: jest.fn(() => true),
    addListener: jest.fn(() => () => {}),
  },
}));
jest.mock('../src/config/loader', () => ({
  config: {
    backend: {
      type: 'rest',
      baseUrl: 'https://bff.example',
      sync: {publicKeys: {'0123456789abcdef': 'A'.repeat(43) + '='}},
    },
  },
}));
jest.mock('../src/services/backendConnector', () => ({
  getBackendConnector: () => ({
    fetchKbManifest: mockFetchKbManifest,
    fetchKbBytes: mockFetchKbBytes,
  }),
}));
jest.mock('../src/services/bundleVerifier', () => ({
  encodeBase64Bytes: jest.fn(() => 'AQID'),
  verifyBundle: (input: unknown) => mockVerifyBundle(input),
}));
jest.mock('../src/knowledge', () => ({
  replaceKnowledgeFromBundle: jest.fn(),
  revertToCompiledKnowledge: jest.fn(),
  getKnowledgeSource: jest.fn(() => 'compiled'),
  getLoadedBundleVersion: jest.fn(() => null),
}));

import RNFS from 'react-native-fs';
import {syncKnowledge} from '../src/services/syncService';

describe('sync bundle verification boundary', () => {
  beforeEach(() => jest.clearAllMocks());

  test('keeps installed bundles unchanged when signature verification fails', async () => {
    const result = await syncKnowledge();

    expect(mockFetchKbManifest).toHaveBeenCalledTimes(1);
    expect(mockFetchKbBytes).toHaveBeenCalledWith(mockManifest);
    expect(result).toMatchObject({
      ok: false,
      action: 'error',
      error: 'bundle_signature_invalid',
    });
    expect(mockVerifyBundle).toHaveBeenCalledWith({
      bytes: Uint8Array.from([1, 2, 3]),
      actualSha256: mockManifest.sha256,
      manifest: mockManifest,
      publicKeys: {'0123456789abcdef': 'A'.repeat(43) + '='},
    });
    expect(RNFS.moveFile).not.toHaveBeenCalled();
    expect(RNFS.unlink).toHaveBeenCalledWith('/tmp/airgap-sync-test/kb/bundle-2.json.partial');
  });
});
