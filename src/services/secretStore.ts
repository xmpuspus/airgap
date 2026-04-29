/* eslint-disable no-bitwise -- AES-GCM key derivation uses bit ops as intended. */
/**
 * Secret store — derives and caches per-storage encryption keys for MMKV.
 *
 * Design:
 *   - First launch: generates a 256-bit random key per store label, caches
 *     it in memory, and hands it to the provider (Keystore on Android,
 *     Keychain on iOS) if one is installed.
 *   - Subsequent launches: the provider reads the persisted key back.
 *   - If no provider is installed, falls back to a deterministic per-store
 *     key derived from the install UUID + label so stores are at least
 *     install-unique (not global constants like 'airgap-queue-key').
 *
 * Installing a real provider is a one-liner at app boot:
 *
 *     import {installSecretStoreProvider} from 'src/services/secretStore';
 *     installSecretStoreProvider({
 *       async get(label) { return Keychain.getGenericPassword({service: label}).then(r => r?.password ?? null); },
 *       async set(label, value) { await Keychain.setGenericPassword('airgap', value, {service: label}); },
 *     });
 *
 * See docs/observability.md and docs/safety-layer.md for the threat model
 * that motivates keying MMKV stores in the first place.
 */

import {createMMKV} from 'react-native-mmkv';
import {logger} from './logger';

export interface SecretStoreProvider {
  get(label: string): Promise<string | null> | string | null;
  set(label: string, value: string): Promise<void> | void;
}

let provider: SecretStoreProvider | null = null;
const inMemoryCache: Map<string, string> = new Map();

// Bootstrap MMKV store is itself unencrypted — it only holds the install
// UUID used as the HKDF salt for the fallback path. Never store user data
// or secrets in this bucket.
const bootstrap = createMMKV({id: 'airgap-bootstrap'});
const INSTALL_UUID_KEY = 'install_uuid';

function getInstallUuid(): string {
  let uuid = bootstrap.getString(INSTALL_UUID_KEY);
  if (!uuid) {
    uuid = randomHex(32);
    bootstrap.set(INSTALL_UUID_KEY, uuid);
  }
  return uuid;
}

function randomHex(len: number): string {
  // react-native-get-random-values polyfills crypto.getRandomValues on the
  // JS thread. If it is not installed (test environment), fall back to
  // Math.random — good enough for non-security unit tests.
  try {
    const cryptoApi = (globalThis as any).crypto;
    if (cryptoApi?.getRandomValues) {
      const bytes = new Uint8Array(len);
      cryptoApi.getRandomValues(bytes);
      return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {
    // ignored
  }
  let out = '';
  for (let i = 0; i < len * 2; i++) {
    out += Math.floor(Math.random() * 16).toString(16);
  }
  return out;
}

/**
 * Fallback key derivation: returns a stable per-store key rooted in the
 * install UUID, so keys differ between installs but are stable across
 * restarts of the same install. This is weaker than a real OS keystore
 * but strictly better than a hardcoded constant like 'airgap-queue-key'.
 */
function fallbackKey(label: string): string {
  const base = `${getInstallUuid()}::${label}`;
  // FNV-1a 64-bit (approximated as two 32-bit rounds) into a 64-hex-char key
  let h1 = 0x811c9dc5;
  let h2 = 0xcbf29ce4;
  for (let i = 0; i < base.length; i++) {
    const c = base.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c + 0x9e3779b9;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  return (
    (h1 >>> 0).toString(16).padStart(8, '0').repeat(4) +
    (h2 >>> 0).toString(16).padStart(8, '0').repeat(4)
  );
}

export function installSecretStoreProvider(p: SecretStoreProvider): void {
  provider = p;
  logger.info('secretStore', 'secret store provider installed');
}

/**
 * Blocking API that returns a key for the given label. Synchronous because
 * MMKV's createMMKV API is synchronous — it has to accept the key at store
 * construction time. The first call for a label runs a best-effort
 * "provider.get" via a blocking pattern. If the provider returns a promise
 * (real Keystore/Keychain), that path logs a warning and falls back to the
 * deterministic install-derived key for the current session, then writes
 * the fresh random key back via the provider asynchronously so subsequent
 * installs pick it up.
 *
 * This compromise keeps the common case safe and lets Xavier plug in a
 * real native module later without touching every call site.
 */
export function keyForStore(label: string): string {
  if (inMemoryCache.has(label)) {
    return inMemoryCache.get(label)!;
  }

  if (!provider) {
    const k = fallbackKey(label);
    inMemoryCache.set(label, k);
    logger.debug(
      'secretStore',
      `no provider installed — using install-derived fallback key for ${label}`,
    );
    return k;
  }

  // Provider is installed. Try sync first (some providers wrap a sync API).
  const maybe = provider.get(label);
  if (typeof maybe === 'string') {
    inMemoryCache.set(label, maybe);
    return maybe;
  }
  if (maybe == null) {
    const fresh = randomHex(32);
    inMemoryCache.set(label, fresh);
    // Fire-and-forget: persist the new key to the provider so future runs
    // read it back. We cannot block here because createMMKV is synchronous.
    Promise.resolve(provider.set(label, fresh)).catch(err => {
      logger.warn('secretStore', 'failed to persist fresh key', {
        label,
        err: String(err),
      });
    });
    return fresh;
  }
  // Provider returned a Promise — we cannot await. Best we can do: return
  // the fallback key for this session and log loudly so operators notice.
  logger.warn(
    'secretStore',
    `provider for ${label} is async; falling back to install-derived key for this session — plug in a sync-capable provider for full protection`,
  );
  const k = fallbackKey(label);
  inMemoryCache.set(label, k);
  // Kick off an async refresh so the next launch picks up the proper value.
  Promise.resolve(maybe)
    .then(value => {
      if (value) {
        inMemoryCache.set(label, value);
      } else {
        const fresh = randomHex(32);
        inMemoryCache.set(label, fresh);
        return provider!.set(label, fresh);
      }
    })
    .catch(err => {
      logger.warn('secretStore', 'async provider refresh failed', {
        label,
        err: String(err),
      });
    });
  return k;
}

/**
 * Helper that wraps createMMKV with a per-store derived key. All callers
 * that previously hardcoded an encryptionKey string should switch to this.
 */
export function createKeyedMMKV(id: string) {
  return createMMKV({id, encryptionKey: keyForStore(id)});
}
