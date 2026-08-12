const mockExists = jest.fn();
const mockStat = jest.fn();
const mockHash = jest.fn();
const mockUnlink = jest.fn(async (_path: string) => undefined);
const mockMoveFile = jest.fn(async (_from: string, _to: string) => undefined);
const mockDownloadFile = jest.fn();

jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/tmp/airgap-model-test',
  exists: (...args: unknown[]) => mockExists(...args),
  stat: (...args: unknown[]) => mockStat(...args),
  hash: (...args: unknown[]) => mockHash(...args),
  unlink: (path: string) => mockUnlink(path),
  moveFile: (from: string, to: string) => mockMoveFile(from, to),
  mkdir: jest.fn(async () => undefined),
  downloadFile: (...args: unknown[]) => mockDownloadFile(...args),
  stopDownload: jest.fn(),
}));
jest.mock('react-native-mmkv', () => require('./helpers/rn-mocks').rnMmkv());
jest.mock('../src/services/secureStorage', () => require('./helpers/rn-mocks').secureStorage());
jest.mock('../src/services/connectivityService', () => ({
  connectivityService: {
    isOnline: jest.fn(() => true),
    isOnWiFi: jest.fn(async () => true),
  },
}));
jest.mock('../src/config/loader', () => ({
  modelConfig: {
    filename: 'model.gguf',
    url: 'https://models.example/model.gguf',
    sizeBytes: 100,
    sizeMB: 1,
    sha256: 'expected-sha',
  },
  config: {backend: {}},
}));

import {modelManager} from '../src/services/modelManager';

describe('model manager file checks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHash.mockResolvedValue('expected-sha');
    mockStat.mockResolvedValue({size: 100});
  });

  test('rejects an existing final file with the wrong length', async () => {
    mockExists.mockResolvedValue(true);
    mockStat.mockResolvedValue({size: 99});

    await expect(modelManager.isModelDownloaded()).resolves.toBe(false);
    expect(mockUnlink).toHaveBeenCalledWith('/tmp/airgap-model-test/models/model.gguf');
  });

  test('restarts a partial download and clamps progress', async () => {
    mockExists.mockImplementation(async (path: string) => {
      if (path.endsWith('/models')) return true;
      if (path.endsWith('/model.gguf.partial')) return true;
      return false;
    });
    mockDownloadFile.mockImplementation(options => {
      options.begin();
      options.progress({bytesWritten: 150, contentLength: 100});
      return {jobId: 1, promise: Promise.resolve({statusCode: 200})};
    });
    const progress: number[] = [];

    await modelManager.downloadModel(value => progress.push(value));

    expect(mockUnlink).toHaveBeenCalledWith('/tmp/airgap-model-test/models/model.gguf.partial');
    expect(mockDownloadFile).toHaveBeenCalledWith(expect.objectContaining({headers: {}}));
    expect(progress.every(value => value >= 0 && value <= 1)).toBe(true);
    expect(mockMoveFile).toHaveBeenCalledWith(
      '/tmp/airgap-model-test/models/model.gguf.partial',
      '/tmp/airgap-model-test/models/model.gguf',
    );
  });
});
