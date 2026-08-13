import {NativeEventEmitter, NativeModules} from 'react-native';
import {InferenceProviderError} from './providerResolver';
import type {
  InferenceCapabilities,
  InferenceProvider,
  InferenceRunStats,
  ProviderFailureReason,
} from './types';

interface AppleNativeCapabilities {
  state: 'available' | 'unavailable';
  reason?: string;
  contextSize?: number;
  modelIdentity?: string;
  osVersion?: string;
  localeSupported?: boolean;
}

interface AppleNativeResult {
  text: string;
  modelIdentity?: string;
}

interface AppleNativeBridge {
  getCapabilities(): Promise<AppleNativeCapabilities>;
  generate(request: {
    requestId: string;
    systemPrompt: string;
    userMessage: string;
  }): Promise<AppleNativeResult>;
  cancel(requestId: string): Promise<boolean>;
}

interface TokenEvent {
  requestId: string;
  token: string;
}

interface EventSubscription {
  remove(): void;
}

interface AppleEventSource {
  addListener(eventName: string, listener: (event: TokenEvent) => void): EventSubscription;
}

const AVAILABILITY_REASONS: Record<string, ProviderFailureReason> = {
  deviceNotEligible: 'unsupported_device',
  appleIntelligenceNotEnabled: 'provider_disabled',
  modelNotReady: 'model_not_ready',
  unsupportedLocale: 'unsupported_locale',
  unsupportedOs: 'unsupported_os',
};

const ERROR_REASONS: Record<string, ProviderFailureReason> = {
  context_exceeded: 'context_exceeded',
  unsupported_locale: 'unsupported_locale',
  cancelled: 'cancelled',
  generation_failed: 'generation_failed',
};

function errorReason(error: unknown): ProviderFailureReason {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as {code: unknown}).code)
      : '';
  return ERROR_REASONS[code] ?? 'generation_failed';
}

export function createAppleFoundationModelsProvider(
  native: AppleNativeBridge | undefined,
  events?: AppleEventSource,
): InferenceProvider {
  let lastStats: InferenceRunStats | null = null;

  return {
    id: 'apple-foundation-models',
    async getCapabilities(): Promise<InferenceCapabilities> {
      if (!native) {
        return {
          providerId: 'apple-foundation-models',
          state: 'unavailable',
          locality: 'local',
          supportsStreaming: true,
          supportsCancellation: true,
          platform: 'ios',
          reason: 'unsupported_device',
        };
      }
      const result = await native.getCapabilities();
      return {
        providerId: 'apple-foundation-models',
        state: result.state,
        locality: 'local',
        supportsStreaming: true,
        supportsCancellation: true,
        platform: 'ios',
        contextSize: result.contextSize,
        modelIdentity: result.modelIdentity,
        osVersion: result.osVersion,
        localeSupported: result.localeSupported,
        reason: result.reason ? AVAILABILITY_REASONS[result.reason] : undefined,
      };
    },
    async generate(request) {
      if (!native) {
        throw new InferenceProviderError(
          'unsupported_device',
          'Apple Foundation Models bridge is unavailable',
          'apple-foundation-models',
        );
      }
      const started = Date.now();
      let firstTokenTimeMs: number | undefined;
      let tokenCount = 0;
      const subscription = events?.addListener('AirgapInferenceToken', event => {
        if (event.requestId !== request.requestId) return;
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
          providerId: 'apple-foundation-models',
          modelIdentity: result.modelIdentity,
          firstTokenTimeMs,
          totalTimeMs: Date.now() - started,
          tokenCount,
        };
        return {
          text: result.text,
          providerId: 'apple-foundation-models',
          modelIdentity: result.modelIdentity,
          locality: 'local',
          stats: lastStats,
        };
      } catch (error) {
        throw new InferenceProviderError(
          errorReason(error),
          error instanceof Error ? error.message : String(error),
          'apple-foundation-models',
        );
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

const appleNativeBridge = NativeModules.AppleFoundationModelsModule as
  | AppleNativeBridge
  | undefined;
const appleEvents = appleNativeBridge
  ? (new NativeEventEmitter(appleNativeBridge as never) as AppleEventSource)
  : undefined;

export const appleFoundationModelsProvider = createAppleFoundationModelsProvider(
  appleNativeBridge,
  appleEvents,
);
