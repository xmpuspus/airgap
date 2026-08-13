/**
 * Config Loader — the single source of truth.
 *
 * Loads airgap.config.json at startup.
 * Every module reads from this instead of hardcoded values.
 * Enterprises edit the JSON file. No TypeScript changes needed.
 */

import rawConfig from '../../airgap.config.json';
import {validateAndLog} from './validate';
import type {
  InferenceMode,
  InferencePlatform,
  ProviderPolicy,
  ProviderPolicyEntry,
} from '../services/inference/types';

// === Types matching the JSON Schema ===

export interface PrivacySection {
  dataRetentionDays?: number;
  allowExport?: boolean;
  allowDeleteData?: boolean;
  privacyPolicyUrl?: string;
}

export interface I18nSection {
  strings?: Record<string, string>;
}

export interface AnalyticsSection {
  enabled?: boolean;
}

export interface AuthSection {
  enabled?: boolean;
  type?: 'pin' | 'biometric' | 'both';
}

export interface LlmSection {
  mode?: 'offline-only' | 'prefer-online' | 'prefer-offline' | 'demo';
  cacheByKbVersion?: boolean;
  supportDomain?: string;
  providers?: LlmProviderConfig[];
  cloud?: {
    enabled?: boolean;
    endpoint?: string;
    audience?: string;
    maxTokens?: number;
    temperature?: number;
  };
}

export type LlmProviderConfig = ProviderPolicyEntry;

export function defaultProviderPolicy(
  mode: InferenceMode,
  platform: InferencePlatform,
): ProviderPolicy {
  const ids =
    mode === 'demo'
      ? (['demo'] as const)
      : mode === 'offline-only'
      ? (['llama-rn'] as const)
      : mode === 'prefer-online'
      ? (['cloud', 'llama-rn'] as const)
      : (['llama-rn', 'cloud'] as const);
  return {
    mode,
    platform,
    providers: ids.map((id, priority) => ({id, enabled: true, priority})),
  };
}

export function providerPolicyFromConfig(
  llm: LlmSection | undefined,
  platform: InferencePlatform,
  locale?: string,
): ProviderPolicy {
  const mode = llm?.mode ?? 'prefer-offline';
  const defaults = defaultProviderPolicy(mode, platform);
  return {
    ...defaults,
    domain: llm?.supportDomain,
    locale,
    providers: llm?.providers ?? defaults.providers,
  };
}

export interface AirgapConfig {
  specVersion: string;
  brand: BrandSection;
  theme: ThemeSection;
  model: ModelSection;
  knowledge: KnowledgeSection;
  prompts: PromptsSection;
  features: FeaturesSection;
  onboarding: OnboardingSection;
  quickReplies: QuickReplyItem[];
  actions: ActionItem[];
  backend: BackendSection;
  queue?: QueueSection;
  support: SupportChannel[];
  locale: LocaleSection;
  privacy?: PrivacySection;
  i18n?: I18nSection;
  analytics?: AnalyticsSection;
  auth?: AuthSection;
  llm?: LlmSection;
}

export interface BrandSection {
  name: string;
  botName: string;
  tagline?: string;
  hotline: string;
  hotlineLabel?: string;
  website?: string;
  logo?: string;
}

export interface ThemeSection {
  primary: string;
  primaryLight?: string;
  primaryDark?: string;
  secondary: string;
  secondaryLight?: string;
  background: string;
  surface?: string;
  text?: string;
  textSecondary?: string;
  textInverse?: string;
  botBubble?: string;
  botBubbleText?: string;
  userBubble?: string;
  userBubbleText?: string;
  success?: string;
  warning?: string;
  error?: string;
  offline?: string;
  border?: string;
  inputBg?: string;
  font?: string;
  darkMode?: boolean | 'auto';
  darkTheme?: Partial<ThemeSection>;
}

export interface ModelSection {
  provider: 'llama.cpp' | 'execu-torch' | 'core-ml' | 'onnx' | 'cloud';
  url: string;
  filename: string;
  sha256?: string;
  sizeBytes?: number;
  sizeMB?: number;
  contextSize?: number;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stopTokens?: string[];
  gpuLayers?: number;
  threads?: number;
}

export interface KnowledgeSection {
  directory: string;
  schema?: string;
  search?: {
    topK?: number;
    fuzzy?: number;
    boostTitle?: number;
    boostKeywords?: number;
    boostContent?: number;
  };
}

export interface PromptsSection {
  system: string;
  welcome: string;
  fallback: string;
  queued?: string;
  noModel?: string;
}

export interface FeaturesSection {
  offlineQueue?: boolean;
  streamingTokens?: boolean;
  userFeedback?: boolean;
  conversationPersistence?: boolean;
  sessionTimeoutMinutes?: number;
  modelDownloadOnboarding?: boolean;
  /** Show the diagnostics/metrics panel in Settings. Off by default. */
  diagnosticsPanel?: boolean;
}

export interface OnboardingSection {
  title?: string;
  subtitle?: string;
  features?: string[];
  downloadPrompt?: string;
  skipLabel?: string;
  wifiNote?: string;
}

export interface QuickReplyItem {
  title: string;
  value: string;
}

export interface ActionItem {
  id: string;
  label: string;
  keywords: string[];
  requiresOnline: boolean;
  category?: string;
  mockResponse?: string;
}

export interface BackendSection {
  type: 'mock' | 'rest';
  baseUrl?: string;
  auth?: {
    type: 'none' | 'provider';
    audience?: string;
  };
  sync?: {
    publicKeys: Record<string, string>;
  };
}

export interface QueueSection {
  maxRetries?: number;
}

export interface SupportChannel {
  type: 'phone' | 'email' | 'chat' | 'social' | 'website';
  value: string;
  label: string;
}

export interface LocaleSection {
  currency?: string;
  language?: string;
  region?: string;
}

// === Load and apply defaults ===

function applyDefaults(raw: any): AirgapConfig {
  return {
    ...raw,
    theme: {
      surface: '#FFFFFF',
      text: '#1A1A2E',
      textSecondary: '#6B7280',
      textInverse: '#FFFFFF',
      botBubble: '#E8EEF6',
      botBubbleText: '#1A1A2E',
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
      offline: '#6B7280',
      border: '#E5E7EB',
      inputBg: '#F9FAFB',
      ...raw.theme,
      // userBubble defaults to primary if not set
      userBubble: raw.theme.userBubble ?? raw.theme.primary,
      userBubbleText: raw.theme.userBubbleText ?? '#FFFFFF',
    },
    model: {
      sizeMB: 2445,
      sizeBytes: 2445645184,
      contextSize: 4096,
      maxTokens: 256,
      temperature: 0.3,
      topP: 0.9,
      stopTokens: ['<end_of_turn>', '<eos>', '</s>'],
      gpuLayers: 99,
      threads: 4,
      ...raw.model,
    },
    knowledge: {
      schema: 'kbdoc-v1',
      ...raw.knowledge,
      search: {
        topK: 3,
        fuzzy: 0.2,
        boostTitle: 3,
        boostKeywords: 2,
        boostContent: 1,
        ...raw.knowledge?.search,
      },
    },
    features: {
      offlineQueue: true,
      streamingTokens: true,
      userFeedback: true,
      conversationPersistence: true,
      sessionTimeoutMinutes: 30,
      modelDownloadOnboarding: true,
      ...raw.features,
    },
    locale: {
      currency: 'PHP',
      language: 'en',
      region: 'PH',
      ...raw.locale,
    },
    privacy: {
      dataRetentionDays: 30,
      allowExport: true,
      allowDeleteData: true,
      ...raw.privacy,
    },
    i18n: {
      strings: {},
      ...raw.i18n,
    },
    analytics: {
      enabled: false,
      ...raw.analytics,
    },
    queue: {
      maxRetries: 3,
      ...raw.queue,
    },
    auth: {
      enabled: false,
      type: 'pin',
      ...raw.auth,
    },
  };
}

// === Template interpolation ===

export function interpolate(template: string, config: AirgapConfig): string {
  const featureList = config.onboarding?.features?.map(f => `- ${f}`).join('\n') ?? '';

  const sizeMB = config.model.sizeMB ?? 2445;
  const modelSize = sizeMB >= 1024 ? `~${(sizeMB / 1024).toFixed(1)} GB` : `~${sizeMB} MB`;

  const vars: Record<string, string> = {
    botName: config.brand.botName,
    brandName: config.brand.name,
    hotline: config.brand.hotline,
    hotlineLabel: config.brand.hotlineLabel ?? '',
    currency: config.locale?.currency ?? 'PHP',
    featureList,
    tagline: config.brand.tagline ?? '',
    modelSizeMB: String(sizeMB),
    modelSize,
  };

  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

// === Singleton config ===

export const config: AirgapConfig = applyDefaults(rawConfig);

// Validate at startup — logs warnings but never throws
validateAndLog(config);

// Convenience accessors
export const brand = config.brand;
export const theme = config.theme;
export const modelConfig = config.model;
export const prompts = config.prompts;
export const features = config.features;
export const actions = config.actions;
export const quickReplies = config.quickReplies;
export const onboarding = config.onboarding;
export const privacy = config.privacy!;
export const i18nConfig = config.i18n!;
export const analyticsConfig = config.analytics!;
export const authConfig = config.auth!;
