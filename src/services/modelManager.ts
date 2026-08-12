import RNFS from 'react-native-fs';
import {modelConfig, config} from '../config/loader';
import {logger} from './logger';
import {getSecureStore} from './secureStorage';
import {connectivityService} from './connectivityService';
import {getBackendConnector, type RemoteModelManifest} from './backendConnector';

const modelStorage = () => getSecureStore('model-manager');
const KEY_DOWNLOADED = 'model_downloaded';
const KEY_LAST_UPDATE_CHECK = 'last_model_update_check';
const KEY_REMOTE_SHA = 'remote_model_sha256';

export interface ModelUpdateResult {
  checked: boolean;
  reason?:
    | 'no_backend'
    | 'offline'
    | 'not_wifi'
    | 'not_yet_due'
    | 'already_current'
    | 'fetch_failed';
  manifest?: RemoteModelManifest;
  hasUpdate?: boolean;
}

export interface ModelStatus {
  isDownloaded: boolean;
  filePath: string;
  sizeBytes: number;
  downloadProgress: number;
}

class ModelManager {
  private modelsDir = `${RNFS.DocumentDirectoryPath}/models`;
  private downloadJobId: number | null = null;

  getModelPath(): string {
    return `${this.modelsDir}/${modelConfig.filename}`;
  }

  private getPartialPath(): string {
    return `${this.getModelPath()}.partial`;
  }

  async isModelDownloaded(): Promise<boolean> {
    const exists = await RNFS.exists(this.getModelPath());
    if (!exists) {
      modelStorage().set(KEY_DOWNLOADED, false);
      return false;
    }
    try {
      await this.verifyChecksum(this.getModelPath());
      modelStorage().set(KEY_DOWNLOADED, true);
      return true;
    } catch {
      modelStorage().set(KEY_DOWNLOADED, false);
      return false;
    }
  }

  private async verifyChecksum(filePath: string): Promise<boolean> {
    // Size check first — fast, catches truncation without re-hashing GBs.
    if (modelConfig.sizeBytes) {
      const stat = await RNFS.stat(filePath);
      const actualSize = Number(stat.size);
      if (actualSize !== modelConfig.sizeBytes) {
        await RNFS.unlink(filePath);
        throw new Error(
          `Model size mismatch: expected ${modelConfig.sizeBytes} bytes, got ${actualSize}`,
        );
      }
    }

    const expected = modelConfig.sha256;
    if (!expected) {
      logger.warn(
        'ModelManager',
        'model.sha256 is empty, skipping checksum verification (not recommended for production)',
      );
      return true;
    }

    logger.info('ModelManager', 'Verifying model checksum...');
    const actual = await RNFS.hash(filePath, 'sha256');

    if (actual !== expected) {
      logger.error('ModelManager', 'Checksum mismatch', {
        expected,
        actual,
      });
      await RNFS.unlink(filePath);
      throw new Error(`Model checksum mismatch: expected ${expected}, got ${actual}`);
    }

    logger.info('ModelManager', 'Checksum verified');
    return true;
  }

  async downloadModel(onProgress: (progress: number) => void): Promise<void> {
    const dirExists = await RNFS.exists(this.modelsDir);
    if (!dirExists) {
      await RNFS.mkdir(this.modelsDir);
    }

    const destPath = this.getModelPath();
    const partialPath = this.getPartialPath();

    const alreadyExists = await RNFS.exists(destPath);
    if (alreadyExists) {
      if (await this.isModelDownloaded()) {
        onProgress(1);
        return;
      }
    }

    // A partial file has no trusted server resume contract. Restart it.
    const partialExists = await RNFS.exists(partialPath);
    if (partialExists) await RNFS.unlink(partialPath);

    const headers: Record<string, string> = {};

    const {jobId, promise} = RNFS.downloadFile({
      fromUrl: modelConfig.url,
      toFile: partialPath,
      headers,
      progressDivider: 2,
      begin: () => onProgress(0),
      progress: res => {
        const fraction = res.contentLength > 0 ? res.bytesWritten / res.contentLength : 0;
        const clamped = Math.max(0, Math.min(1, fraction));
        onProgress(clamped);
      },
    });

    this.downloadJobId = jobId;

    let result;
    try {
      result = await promise;
    } finally {
      this.downloadJobId = null;
    }

    if (result.statusCode !== 200) {
      await RNFS.unlink(partialPath).catch(() => undefined);
      throw new Error(`Model download failed with status ${result.statusCode}`);
    }

    // Verify checksum before promoting partial to final
    await this.verifyChecksum(partialPath);

    // Move partial file to final destination
    await RNFS.moveFile(partialPath, destPath);
    logger.info('ModelManager', 'Model download complete', {path: destPath});

    modelStorage().set(KEY_DOWNLOADED, true);
    onProgress(1);
  }

  async deleteModel(): Promise<void> {
    const path = this.getModelPath();
    const partialPath = this.getPartialPath();

    const exists = await RNFS.exists(path);
    if (exists) {
      await RNFS.unlink(path);
    }

    const partialExists = await RNFS.exists(partialPath);
    if (partialExists) {
      await RNFS.unlink(partialPath);
    }

    modelStorage().set(KEY_DOWNLOADED, false);
    logger.info('ModelManager', 'Model deleted');
  }

  async getModelSizeMB(): Promise<number> {
    const path = this.getModelPath();
    const exists = await RNFS.exists(path);
    if (!exists) {
      return 0;
    }
    const stat = await RNFS.stat(path);
    return Number(stat.size) / (1024 * 1024);
  }

  cancelDownload(): void {
    if (this.downloadJobId !== null) {
      RNFS.stopDownload(this.downloadJobId);
      this.downloadJobId = null;
      logger.info('ModelManager', 'Download cancelled');
    }
  }

  /**
   * Poll the BFF for a newer model. Gated on connectivity AND Wi-Fi —
   * we never burn a user's cellular data on a 2 GB download. Returns
   * a structured result the caller can decide to act on (e.g. surface
   * an "Update available" prompt in Settings).
   *
   * This does NOT actually download the new model. Use applyUpdate()
   * for that — kept separate so the user can opt in.
   */
  async checkForUpdate(options?: {force?: boolean}): Promise<ModelUpdateResult> {
    const backend = (config as unknown as {backend?: {baseUrl?: string}}).backend;
    const baseUrl = backend?.baseUrl?.replace(/\/+$/, '');
    if (!baseUrl) {
      return {checked: false, reason: 'no_backend'};
    }
    if (!connectivityService.isOnline()) {
      return {checked: false, reason: 'offline'};
    }
    if (!options?.force) {
      const onWifi = await connectivityService.isOnWiFi();
      if (!onWifi) {
        return {checked: false, reason: 'not_wifi'};
      }
      // Throttle: don't poll more than once per 6 hours unless forced.
      const last = modelStorage().getNumber(KEY_LAST_UPDATE_CHECK) ?? 0;
      const SIX_HOURS = 6 * 60 * 60 * 1000;
      if (last && Date.now() - last < SIX_HOURS) {
        return {checked: false, reason: 'not_yet_due'};
      }
    }

    try {
      const connector = getBackendConnector();
      if (!connector.fetchModelManifest) {
        return {checked: false, reason: 'fetch_failed'};
      }
      const manifest = await connector.fetchModelManifest();
      modelStorage().set(KEY_LAST_UPDATE_CHECK, Date.now());

      const localSha = modelConfig.sha256;
      const remoteSha = manifest.sha256;
      const hasUpdate = !!remoteSha && !!localSha && remoteSha !== localSha;
      if (remoteSha) modelStorage().set(KEY_REMOTE_SHA, remoteSha);

      logger.info('ModelManager', 'Model update check complete', {
        localSha: localSha?.substring(0, 12),
        remoteSha: remoteSha?.substring(0, 12),
        hasUpdate,
      });

      if (!hasUpdate) {
        return {checked: true, manifest, hasUpdate: false, reason: 'already_current'};
      }
      return {checked: true, manifest, hasUpdate: true};
    } catch (err) {
      logger.warn('ModelManager', 'Model update check failed', {err: String(err)});
      return {checked: false, reason: 'fetch_failed'};
    }
  }

  /**
   * Download a new model bundle from the BFF and atomically swap. The
   * old model is preserved as <filename>.previous.gguf so we can roll
   * back if the new file fails to load. Wi-Fi-only by default.
   */
  async applyUpdate(
    manifest: RemoteModelManifest,
    onProgress?: (fraction: number) => void,
  ): Promise<{ok: boolean; error?: string}> {
    if (!manifest.url || !manifest.sha256 || !manifest.filename) {
      return {ok: false, error: 'manifest missing required fields'};
    }
    if (!(await connectivityService.isOnWiFi())) {
      return {ok: false, error: 'not_on_wifi'};
    }

    const dirExists = await RNFS.exists(this.modelsDir);
    if (!dirExists) await RNFS.mkdir(this.modelsDir);

    const updatePath = `${this.modelsDir}/${manifest.filename}.update.gguf`;
    const finalPath = this.getModelPath();
    const previousPath = `${finalPath}.previous.gguf`;

    try {
      const oldUpdateExists = await RNFS.exists(updatePath);
      if (oldUpdateExists) await RNFS.unlink(updatePath);
      const {promise} = RNFS.downloadFile({
        fromUrl: manifest.url,
        toFile: updatePath,
        progressDivider: 5,
        progress: res => {
          if (onProgress && res.contentLength > 0) {
            onProgress(Math.max(0, Math.min(1, res.bytesWritten / res.contentLength)));
          }
        },
      });
      const result = await promise;
      if (result.statusCode !== 200) {
        await RNFS.unlink(updatePath).catch(() => undefined);
        return {ok: false, error: `HTTP ${result.statusCode}`};
      }

      if (manifest.sizeBytes) {
        const stat = await RNFS.stat(updatePath);
        if (Number(stat.size) !== manifest.sizeBytes) {
          await RNFS.unlink(updatePath).catch(() => undefined);
          return {ok: false, error: 'model_size_invalid'};
        }
      }

      // Verify SHA before swap.
      const actualSha = await RNFS.hash(updatePath, 'sha256');
      if (actualSha !== manifest.sha256) {
        await RNFS.unlink(updatePath).catch(() => undefined);
        return {
          ok: false,
          error: `sha256 mismatch: expected ${manifest.sha256}, got ${actualSha}`,
        };
      }

      // Swap: current -> .previous.gguf, .update.gguf -> current
      const currentExists = await RNFS.exists(finalPath);
      if (currentExists) {
        const prevExists = await RNFS.exists(previousPath);
        if (prevExists) await RNFS.unlink(previousPath);
        await RNFS.moveFile(finalPath, previousPath);
      }
      await RNFS.moveFile(updatePath, finalPath);
      logger.info('ModelManager', 'model update applied', {
        from: modelConfig.sha256?.substring(0, 12),
        to: manifest.sha256.substring(0, 12),
      });
      return {ok: true};
    } catch (err) {
      await RNFS.unlink(updatePath).catch(() => undefined);
      return {ok: false, error: String(err)};
    }
  }
}

export const modelManager = new ModelManager();
