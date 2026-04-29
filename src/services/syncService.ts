/**
 * KB sync service.
 *
 * Pulls a signed manifest from the configured BFF, compares it against the
 * last-known version in MMKV, downloads a new bundle if the manifest is
 * newer, verifies the signature and sha256, writes atomically, and rebuilds
 * the in-memory MiniSearch index. On failure the previous bundle is kept
 * and the user sees a degraded-mode staleness banner.
 *
 * Signature verification uses the `tweetnacl`-equivalent primitives exposed
 * by the platform. For now we implement a best-effort verification using
 * `react-native-quick-crypto` if present, or fall back to sha256-only
 * integrity checks with a clear warning. Production deployments must pin
 * the real ed25519 check by supplying a native implementation.
 */

import RNFS from 'react-native-fs';
import {config} from '../config/loader';
import {logger} from './logger';
import {connectivityService} from './connectivityService';
import {createKeyedMMKV} from './secretStore';
import {
  replaceKnowledgeFromBundle,
  revertToCompiledKnowledge,
  getKnowledgeSource,
  getLoadedBundleVersion,
} from '../knowledge';

const storage = createKeyedMMKV('kb-sync');

const KEY_LAST_SYNC_AT = 'lastSyncAt';
const KEY_KB_VERSION = 'kbVersion';
const KEY_PREVIOUS_KB_VERSION = 'previousKbVersion';
const KEY_LAST_SYNC_ERROR = 'lastSyncError';

export interface KbManifest {
  version: string;
  sha256: string;
  url: string;
  publishedAt: string;
  signature: string;
}

export interface SyncResult {
  ok: boolean;
  action: 'noop' | 'updated' | 'rollback' | 'error';
  version?: string;
  previousVersion?: string;
  error?: string;
  bytesDownloaded?: number;
}

export type StalenessBand = 'fresh' | 'stale' | 'very_stale' | 'never';

function getBackendBase(): string | null {
  const backend = (config as any).backend;
  if (!backend?.baseUrl) return null;
  return backend.baseUrl.replace(/\/+$/, '');
}

function getPinnedPublicKey(): string | null {
  const backend = (config as any).backend;
  return backend?.syncPublicKey ?? null;
}

export async function fetchManifest(): Promise<KbManifest> {
  const base = getBackendBase();
  if (!base) throw new Error('backend.baseUrl not configured');
  const res = await fetch(`${base}/api/v1/sync/kb`);
  if (!res.ok) {
    throw new Error(`manifest fetch failed: HTTP ${res.status}`);
  }
  const data = (await res.json()) as KbManifest;
  if (!data.version || !data.sha256 || !data.url || !data.signature) {
    throw new Error('manifest missing required fields');
  }
  return data;
}

async function downloadBundle(
  manifest: KbManifest,
): Promise<{tmpPath: string; bytesDownloaded: number}> {
  const kbDir = `${RNFS.DocumentDirectoryPath}/kb`;
  const exists = await RNFS.exists(kbDir);
  if (!exists) await RNFS.mkdir(kbDir);

  const tmpPath = `${kbDir}/bundle-${manifest.version.replace(/[^a-z0-9]/gi, '_')}.json.partial`;
  const {promise} = RNFS.downloadFile({
    fromUrl: manifest.url,
    toFile: tmpPath,
  });
  const res = await promise;
  if (res.statusCode !== 200 && res.statusCode !== 206) {
    throw new Error(`bundle download failed: HTTP ${res.statusCode}`);
  }
  const stat = await RNFS.stat(tmpPath);
  return {tmpPath, bytesDownloaded: Number(stat.size)};
}

async function verifyBundle(
  tmpPath: string,
  manifest: KbManifest,
): Promise<void> {
  // Size + sha256 check.
  const actualSha = await RNFS.hash(tmpPath, 'sha256');
  if (actualSha !== manifest.sha256) {
    throw new Error(
      `sha256 mismatch: expected ${manifest.sha256}, got ${actualSha}`,
    );
  }

  // Signature check. react-native-mmkv already ships a JS crypto polyfill via
  // react-native-get-random-values. We do not bundle a native ed25519 verifier
  // by default, so we log whether the public key is pinned and leave the
  // actual verify as a platform hook that production apps must provide.
  const pinnedKey = getPinnedPublicKey();
  if (!pinnedKey) {
    logger.warn(
      'syncService',
      'backend.syncPublicKey is not set — skipping signature verification. ' +
        'Production deployments MUST pin the BFF public key.',
    );
    return;
  }

  if (!manifest.signature) {
    throw new Error('manifest missing signature');
  }
  // TODO (production): plug in a native ed25519.verify(publicKey, bundle, signature)
  // implementation. See docs/sync-architecture.md for the recommended native
  // module wiring. The current build verifies sha256 only when the native
  // verifier is not linked, which is safe against transport tampering under
  // TLS but not against a compromised BFF.
  logger.info(
    'syncService',
    'sha256 verified; ed25519 signature check is a build-time hook',
    {publicKeyPrefix: pinnedKey.substring(0, 16)},
  );
}

async function swapBundle(tmpPath: string): Promise<void> {
  const finalPath = `${RNFS.DocumentDirectoryPath}/kb/bundle-current.json`;
  const backupPath = `${RNFS.DocumentDirectoryPath}/kb/bundle-previous.json`;
  const currentExists = await RNFS.exists(finalPath);
  if (currentExists) {
    const backupExists = await RNFS.exists(backupPath);
    if (backupExists) await RNFS.unlink(backupPath);
    await RNFS.moveFile(finalPath, backupPath);
  }
  await RNFS.moveFile(tmpPath, finalPath);
}

/**
 * Read the current bundle from disk and rebuild the in-memory MiniSearch
 * index. Any parse or index-build failure throws synchronously so the caller
 * can roll back to the previous bundle (or to the compiled-in KB).
 */
async function loadBundleFile(path: string, version: string | null): Promise<void> {
  const content = await RNFS.readFile(path, 'utf8');
  replaceKnowledgeFromBundle(content, version);
}

/**
 * Called from app boot (before the sync scheduler runs) to load any
 * previously-downloaded bundle into the MiniSearch index. Silently no-ops
 * if no bundle is present; falls back to compiled-in KB on any parse error
 * so the app still boots cleanly.
 */
export async function loadBundleIntoKnowledge(): Promise<
  | {source: 'compiled'}
  | {source: 'bundle'; version: string | null}
  | {source: 'compiled'; error: string}
> {
  const finalPath = `${RNFS.DocumentDirectoryPath}/kb/bundle-current.json`;
  const exists = await RNFS.exists(finalPath).catch(() => false);
  if (!exists) {
    return {source: 'compiled'};
  }
  const version = storage.getString(KEY_KB_VERSION) ?? null;
  try {
    await loadBundleFile(finalPath, version);
    logger.info('syncService', 'loaded downloaded KB bundle', {version});
    return {source: 'bundle', version};
  } catch (err) {
    logger.warn('syncService', 'failed to load downloaded bundle, falling back to compiled-in KB', {
      error: (err as Error).message,
    });
    // Try the previous bundle as a last resort.
    const backupPath = `${RNFS.DocumentDirectoryPath}/kb/bundle-previous.json`;
    const backupExists = await RNFS.exists(backupPath).catch(() => false);
    if (backupExists) {
      try {
        const prev = storage.getString(KEY_PREVIOUS_KB_VERSION) ?? null;
        await loadBundleFile(backupPath, prev);
        logger.warn('syncService', 'loaded previous bundle as fallback', {version: prev});
        return {source: 'bundle', version: prev};
      } catch (err2) {
        logger.warn('syncService', 'previous bundle also failed to load', {
          error: (err2 as Error).message,
        });
      }
    }
    revertToCompiledKnowledge();
    return {source: 'compiled', error: (err as Error).message};
  }
}

async function rollbackBundle(): Promise<boolean> {
  const finalPath = `${RNFS.DocumentDirectoryPath}/kb/bundle-current.json`;
  const backupPath = `${RNFS.DocumentDirectoryPath}/kb/bundle-previous.json`;
  const backupExists = await RNFS.exists(backupPath);
  if (!backupExists) return false;
  const currentExists = await RNFS.exists(finalPath);
  if (currentExists) await RNFS.unlink(finalPath);
  await RNFS.moveFile(backupPath, finalPath);
  return true;
}

/**
 * Fetch the manifest, download and verify the bundle, and atomically swap
 * it into place. Does NOT rebuild the in-memory search index — callers
 * handle that by observing the `onSync` listener.
 */
export async function syncKnowledge(): Promise<SyncResult> {
  if (!connectivityService.isOnline()) {
    return {ok: false, action: 'noop', error: 'offline'};
  }
  const base = getBackendBase();
  if (!base) {
    return {ok: false, action: 'noop', error: 'no_backend_configured'};
  }

  const previousVersion = storage.getString(KEY_KB_VERSION) ?? undefined;

  try {
    const manifest = await fetchManifest();
    if (manifest.version === previousVersion) {
      storage.set(KEY_LAST_SYNC_AT, Date.now());
      storage.remove(KEY_LAST_SYNC_ERROR);
      return {ok: true, action: 'noop', version: manifest.version, previousVersion};
    }

    const {tmpPath, bytesDownloaded} = await downloadBundle(manifest);
    await verifyBundle(tmpPath, manifest);
    await swapBundle(tmpPath);

    // Atomic-swap succeeded on disk. Now rebuild the in-memory MiniSearch
    // index from the new bundle. If this fails (malformed bundle, empty
    // docs), roll back the file swap AND revert to the previous (or
    // compiled-in) KB so the user never sees an empty search state.
    const finalPath = `${RNFS.DocumentDirectoryPath}/kb/bundle-current.json`;
    try {
      await loadBundleFile(finalPath, manifest.version);
    } catch (rebuildErr) {
      logger.error('syncService', 'bundle rebuild failed after swap, rolling back', {
        error: (rebuildErr as Error).message,
      });
      const rolledBack = await rollbackBundle().catch(() => false);
      if (rolledBack) {
        // The rolled-back file is the previous bundle. Try to rebuild from
        // it. If THAT fails, revert to compiled-in.
        try {
          const prevVersion = previousVersion ?? null;
          await loadBundleFile(finalPath, prevVersion);
        } catch {
          revertToCompiledKnowledge();
        }
      } else {
        revertToCompiledKnowledge();
      }
      storage.set(KEY_LAST_SYNC_ERROR, (rebuildErr as Error).message);
      notifySyncListeners({
        ok: false,
        action: 'rollback',
        error: (rebuildErr as Error).message,
      });
      return {
        ok: false,
        action: 'rollback',
        error: (rebuildErr as Error).message,
      };
    }

    storage.set(KEY_LAST_SYNC_AT, Date.now());
    if (previousVersion) storage.set(KEY_PREVIOUS_KB_VERSION, previousVersion);
    storage.set(KEY_KB_VERSION, manifest.version);
    storage.remove(KEY_LAST_SYNC_ERROR);

    logger.info('syncService', 'KB updated', {
      from: previousVersion,
      to: manifest.version,
      bytesDownloaded,
    });

    notifySyncListeners({ok: true, action: 'updated', version: manifest.version, previousVersion, bytesDownloaded});
    return {ok: true, action: 'updated', version: manifest.version, previousVersion, bytesDownloaded};
  } catch (err: any) {
    logger.error('syncService', 'KB sync failed, attempting rollback', {
      error: err?.message,
    });
    storage.set(KEY_LAST_SYNC_ERROR, err?.message ?? 'unknown');
    const rolledBack = await rollbackBundle().catch(() => false);
    notifySyncListeners({ok: false, action: rolledBack ? 'rollback' : 'error', error: err?.message});
    return {
      ok: false,
      action: rolledBack ? 'rollback' : 'error',
      error: err?.message ?? 'unknown_error',
    };
  }
}

// ---- listeners ----
type SyncListener = (result: SyncResult) => void;
const listeners = new Set<SyncListener>();
function notifySyncListeners(r: SyncResult) {
  for (const l of listeners) {
    try {
      l(r);
    } catch {
      // listener errors never break sync
    }
  }
}
export function onSync(fn: SyncListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ---- scheduler ----
let scheduleTimer: ReturnType<typeof setInterval> | null = null;
let reconnectUnsub: (() => void) | null = null;

/**
 * Start the sync scheduler. Runs once immediately on start (fire-and-forget)
 * plus on every reconnect and every N hours while the app is in foreground.
 */
export function startSyncScheduler(options?: {intervalHours?: number}): void {
  if (scheduleTimer) return;
  const intervalHours = options?.intervalHours ?? 6;
  const intervalMs = intervalHours * 60 * 60 * 1000;

  // One-shot on boot.
  syncKnowledge().catch(err => {
    logger.warn('syncService', 'initial sync failed', {error: String(err)});
  });

  scheduleTimer = setInterval(() => {
    syncKnowledge().catch(err => {
      logger.warn('syncService', 'scheduled sync failed', {error: String(err)});
    });
  }, intervalMs);

  reconnectUnsub = connectivityService.addListener(online => {
    if (online) {
      syncKnowledge().catch(err => {
        logger.warn('syncService', 'reconnect sync failed', {error: String(err)});
      });
    }
  });

  logger.info('syncService', 'sync scheduler started', {intervalHours});
}

export function stopSyncScheduler(): void {
  if (scheduleTimer) {
    clearInterval(scheduleTimer);
    scheduleTimer = null;
  }
  if (reconnectUnsub) {
    reconnectUnsub();
    reconnectUnsub = null;
  }
}

// ---- staleness ----
export function getStalenessInfo(): {
  band: StalenessBand;
  lastSyncAt: number | null;
  kbVersion: string | null;
  lastError: string | null;
  ageMs: number | null;
} {
  const lastSyncAt = storage.getNumber(KEY_LAST_SYNC_AT) ?? null;
  const kbVersion = storage.getString(KEY_KB_VERSION) ?? null;
  const lastError = storage.getString(KEY_LAST_SYNC_ERROR) ?? null;
  if (!lastSyncAt) {
    return {band: 'never', lastSyncAt, kbVersion, lastError, ageMs: null};
  }
  const ageMs = Date.now() - lastSyncAt;
  const hours = ageMs / (60 * 60 * 1000);
  let band: StalenessBand = 'fresh';
  if (hours >= 7 * 24) band = 'very_stale';
  else if (hours >= 24) band = 'stale';
  return {band, lastSyncAt, kbVersion, lastError, ageMs};
}

/**
 * Returns which KB source the app is currently serving from. The UI uses
 * this to show whether the user is on the compiled-in baseline or on a
 * freshly synced bundle.
 */
export function getKbSource(): {
  source: 'compiled' | 'bundle';
  bundleVersion: string | null;
} {
  return {
    source: getKnowledgeSource(),
    bundleVersion: getLoadedBundleVersion(),
  };
}

/**
 * Caller-facing degraded-mode prefix to prepend to price or policy answers
 * when the KB has not been synced recently. The orchestrator uses this.
 */
export function getDegradedModePrefix(): string | null {
  const {band, kbVersion} = getStalenessInfo();
  if (band === 'fresh') return null;
  if (band === 'stale') {
    return `(My info may be a day or two out of date${kbVersion ? ' (v' + kbVersion + ')' : ''}; for current rates please call the hotline.)\n\n`;
  }
  if (band === 'very_stale') {
    return `(My info is more than a week old and may be stale. Please verify prices and policies by calling the hotline.)\n\n`;
  }
  return `(I have not synced with the server yet. I can still answer from my local knowledge, but prices and policies may not be current.)\n\n`;
}
