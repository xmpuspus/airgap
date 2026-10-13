import RNFS from 'react-native-fs';
import {modelConfig, config} from '../config/loader';
import {logger} from './logger';
import {getSecureStore} from './secureStorage';
import {connectivityService} from './connectivityService';
import {getBackendConnector, type RemoteModelManifest} from './backendConnector';

const modelStorage = () => getSecureStore('model-manager');
const KEY_DOWNLOADED = 'model_downloaded';
const KEY_LAST_UPDATE_CHECK = 'last_model_update_check';

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

class ModelManager {
  private modelsDir = `${RNFS.DocumentDirectoryPath}/models`;

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
    // Size check first: it catches truncation without re-hashing gigabytes.
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

    const {promise} = RNFS.downloadFile({
      fromUrl: modelConfig.url,
      toFile: partialPath,
      progressDivider: 2,
      begin: () => onProgress(0),
      progress: res => {
        const fraction = res.contentLength > 0 ? res.bytesWritten / res.contentLength : 0;
        const clamped = Math.max(0, Math.min(1, fraction));
        onProgress(clamped);
      },
    });

    const result = await promise;

    if (result.statusCode !== 200) {
      await RNFS.unlink(partialPath).catch(() => undefined);
      throw new Error(`Model download failed with status ${result.statusCode}`);
    }

    await this.verifyChecksum(partialPath);
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

  /**
   * Poll the BFF for a newer model. Gated on connectivity and Wi-Fi,
   * so a user's cellular data is never spent on a 2 GB download.
   * Returns a structured result the caller can act on, for example
   * an "Update available" prompt in Settings. It does not download the model.
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
}

export const modelManager = new ModelManager();
