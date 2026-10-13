// Sync update rules: which manifest versions install, what text reaches the
// search index, and what the staleness notice says.

const mockManifest = {
  algorithm: 'Ed25519',
  signatureEncoding: 'base64',
  byteLength: 3,
  sha256: 'a'.repeat(64),
  version: '3',
  keyId: '0123456789abcdef',
  url: 'https://bff.example/api/v1/sync/kb/download',
  publishedAt: '2026-08-12T00:00:00.000Z',
  signature: 'signature',
};
const mockFetchKbManifest = jest.fn(async () => mockManifest);
const mockFetchKbBytes = jest.fn(async () => Uint8Array.from([1, 2, 3]));
const mockVerifyBundle = jest.fn((_input: unknown) => ({
  version: mockManifest.version,
  keyId: mockManifest.keyId,
  text: 'VERIFIED_TEXT',
  bundle: {files: {}, generatedAt: ''},
}));
const mockReplaceKnowledge = jest.fn();

jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/tmp/airgap-sync-update',
  exists: jest.fn(async (path: string) => path.endsWith('/kb')),
  mkdir: jest.fn(async () => undefined),
  writeFile: jest.fn(async () => undefined),
  hash: jest.fn(async () => 'a'.repeat(64)),
  moveFile: jest.fn(async () => undefined),
  unlink: jest.fn(async () => undefined),
  readFile: jest.fn(async () => 'DISK_TEXT'),
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
  brand: {hotline: '1-800-TEST'},
  i18nConfig: {strings: {}},
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
  replaceKnowledgeFromBundle: (...args: unknown[]) => mockReplaceKnowledge(...args),
  revertToCompiledKnowledge: jest.fn(),
  getKnowledgeSource: jest.fn(() => 'compiled'),
  getLoadedBundleVersion: jest.fn(() => null),
}));

import RNFS from 'react-native-fs';
import {getSecureStore} from '../src/services/secureStorage';
import {getDegradedModePrefix, syncKnowledge} from '../src/services/syncService';

const store = getSecureStore('kb-sync');

function install(installed: string, offered: string) {
  store.set('kbVersion', installed);
  mockManifest.version = offered;
}

describe('sync version rules', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    store.clearAll();
  });

  test('installs a newer version', async () => {
    install('2', '3');
    const result = await syncKnowledge();
    expect(result).toMatchObject({ok: true, action: 'updated', version: '3'});
  });

  test('hands the verified text to the index and does not read the file again', async () => {
    install('2', '3');
    await syncKnowledge();
    expect(mockReplaceKnowledge).toHaveBeenCalledWith('VERIFIED_TEXT', '3');
    expect(RNFS.readFile).not.toHaveBeenCalled();
  });

  test.each([
    ['2', '1'],
    ['10', '9'],
    ['2026.08', '2026.07'],
    ['2026-10-13T00:00:00.000Z', '2026-10-01T00:00:00.000Z'],
  ])('rejects version %s replaced by older %s before any download', async (installed, offered) => {
    install(installed, offered);
    const result = await syncKnowledge();
    expect(result).toMatchObject({ok: false, action: 'noop', error: 'older_version'});
    expect(mockFetchKbBytes).not.toHaveBeenCalled();
    expect(store.getString('kbVersion')).toBe(installed);
  });

  test.each([
    ['9', '10'],
    ['2026-10-01T00:00:00.000Z', '2026-10-13T00:00:00.000Z'],
  ])('installs %s replaced by newer %s', async (installed, offered) => {
    install(installed, offered);
    expect(await syncKnowledge()).toMatchObject({ok: true, action: 'updated'});
  });

  test('treats the same version as already current', async () => {
    install('3', '3');
    expect(await syncKnowledge()).toMatchObject({ok: true, action: 'noop'});
    expect(mockFetchKbBytes).not.toHaveBeenCalled();
  });
});

describe('degraded mode notice', () => {
  beforeEach(() => store.clearAll());

  test('a day-old sync names the configured hotline', () => {
    store.set('lastSyncAt', Date.now() - 2 * 24 * 60 * 60 * 1000);
    const prefix = getDegradedModePrefix() ?? '';
    expect(prefix).toContain('more than a day old');
    expect(prefix).toContain('1-800-TEST');
    expect(prefix).not.toMatch(/rates|the hotline/);
  });
});
