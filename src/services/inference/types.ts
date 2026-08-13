export type InferenceProviderId =
  | 'apple-foundation-models'
  | 'android-aicore'
  | 'llama-rn'
  | 'cloud'
  | 'demo';

export type ProviderState =
  | 'available'
  | 'downloadable'
  | 'downloading'
  | 'unavailable'
  | 'disabled';

export type ProviderFailureReason =
  | 'unsupported_device'
  | 'unsupported_os'
  | 'unsupported_locale'
  | 'provider_disabled'
  | 'model_not_ready'
  | 'download_required'
  | 'busy'
  | 'quota_exceeded'
  | 'background_blocked'
  | 'context_exceeded'
  | 'generation_failed'
  | 'cancelled';

export type InferenceLocality = 'local' | 'cloud';
export type InferencePlatform = 'ios' | 'android';
export type InferenceMode = 'offline-only' | 'prefer-online' | 'prefer-offline' | 'demo';

export interface InferenceCapabilities {
  providerId: InferenceProviderId;
  state: ProviderState;
  locality: InferenceLocality;
  supportsStreaming: boolean;
  supportsCancellation: boolean;
  contextSize?: number;
  modelIdentity?: string;
  platform?: InferencePlatform;
  osVersion?: string;
  localeSupported?: boolean;
  reason?: ProviderFailureReason;
}

export interface InferenceRequest {
  requestId: string;
  systemPrompt: string;
  userMessage: string;
  onToken?: (token: string) => void;
  signal?: AbortSignal;
}

export interface InferenceRunStats {
  providerId: InferenceProviderId;
  modelIdentity?: string;
  loadTimeMs?: number;
  firstTokenTimeMs?: number;
  totalTimeMs: number;
  tokenCount?: number;
}

export interface InferenceResult {
  text: string;
  providerId: InferenceProviderId;
  modelIdentity?: string;
  locality: InferenceLocality;
  stats?: InferenceRunStats;
}

export interface InferenceProvider {
  readonly id: InferenceProviderId;
  getCapabilities(): Promise<InferenceCapabilities>;
  generate(request: InferenceRequest): Promise<InferenceResult>;
  cancel(requestId: string): Promise<void>;
  getLastRunStats(): InferenceRunStats | null;
}

export interface ProviderPolicyEntry {
  id: InferenceProviderId;
  enabled: boolean;
  priority: number;
  platform?: InferencePlatform | 'all';
  allowedDomains?: string[];
  blockedDomains?: string[];
  minimumOsVersion?: string;
  locales?: string[];
  allowModelDownload?: boolean;
  allowCloudFallback?: boolean;
}

export interface ProviderPolicy {
  mode: InferenceMode;
  platform: InferencePlatform;
  domain?: string;
  locale?: string;
  providers: ProviderPolicyEntry[];
}
