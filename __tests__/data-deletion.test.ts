const mockConversationClear = jest.fn();
const mockQueueClear = jest.fn();
const mockTelemetryClear = jest.fn();
const mockDeleteModel = jest.fn(async () => undefined);
const mockClearSecureStore = jest.fn();
const mockClearDownloadedKnowledge = jest.fn(async () => undefined);

jest.mock('../src/services/conversationStore', () => ({
  conversationStore: {clear: () => mockConversationClear()},
}));
jest.mock('../src/services/offlineQueue', () => ({
  offlineQueue: {clear: () => mockQueueClear()},
}));
jest.mock('../src/services/telemetry', () => ({
  clearBuffer: () => mockTelemetryClear(),
}));
jest.mock('../src/services/modelManager', () => ({
  modelManager: {deleteModel: () => mockDeleteModel()},
}));
jest.mock('../src/services/secureStorage', () => ({
  clearSecureStore: (id: string) => mockClearSecureStore(id),
}));
jest.mock('../src/services/syncService', () => ({
  clearDownloadedKnowledge: () => mockClearDownloadedKnowledge(),
}));

import {deleteAllUserData} from '../src/services/dataDeletionService';

describe('delete all user data', () => {
  beforeEach(() => jest.clearAllMocks());

  test('runs every registered deletion operation', async () => {
    const results = await deleteAllUserData();

    expect(results.every(result => result.ok)).toBe(true);
    expect(results.map(result => result.id)).toEqual([
      'conversation',
      'offline-queue',
      'telemetry-buffer',
      'knowledge-files',
      'kb-sync',
      'model-files',
      'model-manager',
      'user-prefs',
      'app-state',
    ]);
    expect(mockConversationClear).toHaveBeenCalledTimes(1);
    expect(mockQueueClear).toHaveBeenCalledTimes(1);
    expect(mockTelemetryClear).toHaveBeenCalledTimes(1);
    expect(mockDeleteModel).toHaveBeenCalledTimes(1);
    expect(mockClearDownloadedKnowledge).toHaveBeenCalledTimes(1);
    expect(mockClearSecureStore).toHaveBeenCalledWith('kb-sync');
    expect(mockClearSecureStore).toHaveBeenCalledWith('user-prefs');
    expect(mockClearSecureStore).toHaveBeenCalledWith('app-state');
  });

  test('returns a result for a failed operation and continues', async () => {
    mockDeleteModel.mockRejectedValueOnce(new Error('file locked'));

    const results = await deleteAllUserData();

    expect(results.find(result => result.id === 'model-files')).toEqual({
      id: 'model-files',
      ok: false,
      error: 'file locked',
    });
    expect(mockClearSecureStore).toHaveBeenCalledWith('app-state');
  });
});
