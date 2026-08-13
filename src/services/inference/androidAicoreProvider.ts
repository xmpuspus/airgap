import {NativeEventEmitter, NativeModules} from 'react-native';
import {InferenceProviderError} from './providerResolver';
import type {
  InferenceCapabilities,
  InferenceProvider,
  InferenceRunStats,
  ProviderFailureReason,
  ProviderState,
} from './types';

interface AndroidNativeCapabilities {
  state: 'AVAILABLE' | 'DOWNLOADABLE' | 'DOWNLOADING' | 'UNAVAILABLE' | 'UNSUPPORTED_OS';
  contextSize?: number;
  modelIdentity?: string;
  osVersion?: string;
}

interface AndroidNativeResult {
  text: string;
  modelIdentity?: string;
}

interface AndroidNativeBridge {
  getCapabilities(): Promise<AndroidNativeCapabilities>;
  download(requestId: string): Promise<boolean>;
  warmup(): Promise<boolean>;
  generate(request: {
    requestId: string;
    systemPrompt: string;
    userMessage: string;
  }): Promise<AndroidNativeResult>;
  cancel(requestId: string): Promise<boolean>;
}

interface NativeEvent {
  requestId: string;
  token?: string;
  bytesDownloaded?: number;
  totalBytes?: number;
}

interface EventSubscription {
  remove(): void;
}

interface AndroidEventSource {
  addListener(eventName: string, listener: (event: NativeEvent) => void): EventSubscription;
}

export interface AndroidDownloadProgress {
  bytesDownloaded: number;
  totalBytes?: number;
}

export interface AndroidAicoreProvider extends InferenceProvider {
  download(
    requestId: string,
    onProgress?: (progress: AndroidDownloadProgress) => void,
  ): Promise<void>;
  warmup(): Promise<void>;
}

const STATE_MAP: Record<AndroidNativeCapabilities['state'], ProviderState> = {
  AVAILABLE: 'available',
  DOWNLOADABLE: 'downloadable',
  DOWNLOADING: 'downloading',
  UNAVAILABLE: 'unavailable',
  UNSUPPORTED_OS: 'unavailable',
};

const REASON_MAP: Partial<Record<AndroidNativeCapabilities['state'], ProviderFailureReason>> = {
  DOWNLOADABLE: 'download_required',
  DOWNLOADING: 'download_required',
  UNAVAILABLE: 'unsupported_device',
  UNSUPPORTED_OS: 'unsupported_os',
};

const ERROR_REASONS: Record<string, ProviderFailureReason> = {
  quota_exceeded: 'quota_exceeded',
  background_blocked: 'background_blocked',
  context_exceeded: 'context_exceeded',
  unsupported_locale: 'unsupported_locale',
  model_not_ready: 'model_not_ready',
  busy: 'busy',
  cancelled: 'cancelled',
  generation_failed: 'generation_failed',
};

function normalizedError(error: unknown): InferenceProviderError {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as {code: unknown}).code)
      : '';
  return new InferenceProviderError(
    ERROR_REASONS[code] ?? 'generation_failed',
    error instanceof Error ? error.message : String(error),
    'android-aicore',
  );
}

export function createAndroidAicoreProvider(
  native: AndroidNativeBridge | undefined,
  events?: AndroidEventSource,
): AndroidAicoreProvider {
  let lastStats: InferenceRunStats | null = null;

  return {
    id: 'android-aicore',
    async getCapabilities(): Promise<InferenceCapabilities> {
      if (!native) {
        return {
          providerId: 'android-aicore',
          state: 'unavailable',
          locality: 'local',
          supportsStreaming: true,
          supportsCancellation: true,
          platform: 'android',
          reason: 'unsupported_device',
        };
      }
      const result = await native.getCapabilities();
      return {
        providerId: 'android-aicore',
        state: STATE_MAP[result.state],
        locality: 'local',
        supportsStreaming: true,
        supportsCancellation: true,
        platform: 'android',
        contextSize: result.contextSize,
        modelIdentity: result.modelIdentity,
        osVersion: result.osVersion,
        reason: REASON_MAP[result.state],
      };
    },
    async download(requestId, onProgress) {
      if (!native) {
        throw new InferenceProviderError(
          'unsupported_device',
          'Android AICore bridge is unavailable',
          'android-aicore',
        );
      }
      const subscription = events?.addListener('AirgapInferenceDownload', event => {
        if (event.requestId !== requestId || event.bytesDownloaded === undefined) return;
        onProgress?.({
          bytesDownloaded: event.bytesDownloaded,
          totalBytes: event.totalBytes,
        });
      });
      try {
        await native.download(requestId);
      } catch (error) {
        throw normalizedError(error);
      } finally {
        subscription?.remove();
      }
    },
    async warmup() {
      if (!native) {
        throw new InferenceProviderError(
          'unsupported_device',
          'Android AICore bridge is unavailable',
          'android-aicore',
        );
      }
      try {
        await native.warmup();
      } catch (error) {
        throw normalizedError(error);
      }
    },
    async generate(request) {
      if (!native) {
        throw new InferenceProviderError(
          'unsupported_device',
          'Android AICore bridge is unavailable',
          'android-aicore',
        );
      }
      const started = Date.now();
      let firstTokenTimeMs: number | undefined;
      let tokenCount = 0;
      const subscription = events?.addListener('AirgapInferenceToken', event => {
        if (event.requestId !== request.requestId || !event.token) return;
        if (firstTokenTimeMs === undefined) firstTokenTimeMs = Date.now() - started;
        tokenCount += 1;
        request.onToken?.(event.token);
      });
      try {
        const result = await native.generate({
          requestId: request.requestId,
          systemPrompt: request.systemPrompt,
          userMessage: request.userMessage,
        });
        lastStats = {
          providerId: 'android-aicore',
          modelIdentity: result.modelIdentity,
          firstTokenTimeMs,
          totalTimeMs: Date.now() - started,
          tokenCount,
        };
        return {
          text: result.text,
          providerId: 'android-aicore',
          modelIdentity: result.modelIdentity,
          locality: 'local',
          stats: lastStats,
        };
      } catch (error) {
        throw normalizedError(error);
      } finally {
        subscription?.remove();
      }
    },
    async cancel(requestId) {
      if (native) await native.cancel(requestId);
    },
    getLastRunStats() {
      return lastStats;
    },
  };
}

const androidNativeBridge = NativeModules.AndroidAicoreModule as AndroidNativeBridge | undefined;
const androidEvents = androidNativeBridge
  ? (new NativeEventEmitter(androidNativeBridge as never) as AndroidEventSource)
  : undefined;

export const androidAicoreProvider = createAndroidAicoreProvider(
  androidNativeBridge,
  androidEvents,
);
