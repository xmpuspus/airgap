jest.mock('react-native-keychain', () => ({
  __esModule: true,
  getGenericPassword: jest.fn(),
  setGenericPassword: jest.fn(),
  ACCESSIBLE: {
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'device-only',
  },
  STORAGE_TYPE: {
    AES_GCM_NO_AUTH: 'aes-gcm',
  },
}));

jest.mock('react-native-mmkv', () => ({
  createMMKV: jest.fn((options: {id: string; encryptionKey: string}) => ({
    id: options.id,
    encryptionKey: options.encryptionKey,
    set: jest.fn(),
    getString: jest.fn(),
    getNumber: jest.fn(),
    getBoolean: jest.fn(),
    remove: jest.fn(),
    clearAll: jest.fn(),
  })),
}));

const mockKeychain = jest.requireMock('react-native-keychain') as {
  getGenericPassword: jest.Mock;
  setGenericPassword: jest.Mock;
};
const mockMMKV = jest.requireMock('react-native-mmkv') as {
  createMMKV: jest.Mock;
};

import {
  clearSecureStore,
  getSecureStore,
  initializeSecureStorage,
  resetSecureStorageForTests,
} from '../src/services/secureStorage';

describe('secure storage', () => {
  beforeEach(() => {
    resetSecureStorageForTests();
    mockKeychain.getGenericPassword.mockReset();
    mockKeychain.setGenericPassword.mockReset();
    mockMMKV.createMMKV.mockClear();
    mockKeychain.setGenericPassword.mockResolvedValue({
      service: 'airgap',
      storage: 'aes-gcm',
    });
  });

  it('rejects store access before secure startup', () => {
    expect(() => getSecureStore('offline-queue')).toThrow('secure_storage_not_ready');
  });

  it('stores a random 256-bit key in the platform key store', async () => {
    mockKeychain.getGenericPassword.mockResolvedValue(false);

    await initializeSecureStorage(['offline-queue']);

    expect(mockKeychain.setGenericPassword).toHaveBeenCalledWith(
      'airgap',
      expect.stringMatching(/^[a-f0-9]{64}$/),
      {
        accessible: 'device-only',
        service: 'airgap.storage.offline-queue',
        storage: 'aes-gcm',
      },
    );
    expect(mockMMKV.createMMKV).toHaveBeenCalledWith({
      id: 'offline-queue',
      encryptionKey: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });

  it('reuses the key returned by the platform key store', async () => {
    const storedKey = 'ab'.repeat(32);
    mockKeychain.getGenericPassword.mockResolvedValue({
      username: 'airgap',
      password: storedKey,
      service: 'airgap.storage.offline-queue',
      storage: 'aes-gcm',
    });

    await initializeSecureStorage(['offline-queue']);

    expect(mockMMKV.createMMKV).toHaveBeenCalledWith({
      id: 'offline-queue',
      encryptionKey: storedKey,
    });
    expect(mockKeychain.setGenericPassword).not.toHaveBeenCalled();
  });

  it('fails closed when the platform key store fails', async () => {
    mockKeychain.getGenericPassword.mockRejectedValue(new Error('locked'));

    await expect(initializeSecureStorage(['offline-queue'])).rejects.toThrow(
      'secure_storage_unavailable',
    );
    expect(() => getSecureStore('offline-queue')).toThrow('secure_storage_not_ready');
  });

  it('clears one secure store', async () => {
    mockKeychain.getGenericPassword.mockResolvedValue({
      username: 'airgap',
      password: 'cd'.repeat(32),
      service: 'airgap.storage.offline-queue',
      storage: 'aes-gcm',
    });
    await initializeSecureStorage(['offline-queue']);
    const store = getSecureStore('offline-queue');

    clearSecureStore('offline-queue');

    expect(store.clearAll).toHaveBeenCalledTimes(1);
  });
});
