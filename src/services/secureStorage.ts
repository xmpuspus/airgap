import {createMMKV, type MMKV} from 'react-native-mmkv';
import {
  ACCESSIBLE,
  STORAGE_TYPE,
  getGenericPassword,
  setGenericPassword,
} from 'react-native-keychain';

export const SECURE_STORE_IDS = [
  'app-state',
  'conversation',
  'kb-sync',
  'model-manager',
  'offline-queue',
  'telemetry-buffer',
  'user-prefs',
] as const;

export type SecureStoreId = (typeof SECURE_STORE_IDS)[number];

const KEYCHAIN_PREFIX = 'airgap.storage.';
const stores = new Map<SecureStoreId, MMKV>();
let ready = false;

function randomKey(): string {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) {
    throw new Error('secure_random_unavailable');
  }

  const bytes = new Uint8Array(32);
  cryptoApi.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function keyForStore(id: SecureStoreId): Promise<string> {
  const service = `${KEYCHAIN_PREFIX}${id}`;
  const saved = await getGenericPassword({service});
  if (saved) {
    if (!/^[a-f0-9]{64}$/.test(saved.password)) {
      throw new Error('secure_storage_key_invalid');
    }
    return saved.password;
  }

  const key = randomKey();
  const result = await setGenericPassword('airgap', key, {
    accessible: ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    service,
    storage: STORAGE_TYPE.AES_GCM_NO_AUTH,
  });
  if (!result) {
    throw new Error('secure_storage_key_write_failed');
  }
  return key;
}

export async function initializeSecureStorage(
  labels: readonly SecureStoreId[] = SECURE_STORE_IDS,
): Promise<void> {
  ready = false;
  stores.clear();

  try {
    for (const id of labels) {
      const encryptionKey = await keyForStore(id);
      stores.set(id, createMMKV({id, encryptionKey}));
    }
    ready = true;
  } catch (error) {
    stores.clear();
    const wrapped = new Error('secure_storage_unavailable') as Error & {
      cause?: unknown;
    };
    wrapped.cause = error;
    throw wrapped;
  }
}

export function getSecureStore(id: SecureStoreId): MMKV {
  if (!ready) {
    throw new Error('secure_storage_not_ready');
  }
  const store = stores.get(id);
  if (!store) {
    throw new Error(`secure_storage_store_missing:${id}`);
  }
  return store;
}

export function clearSecureStore(id: SecureStoreId): void {
  getSecureStore(id).clearAll();
}

export function resetSecureStorageForTests(): void {
  ready = false;
  stores.clear();
}
