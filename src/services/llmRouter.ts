import {Platform} from 'react-native';
import {config, providerPolicyFromConfig} from '../config/loader';
import type {LlmSection} from '../config/loader';
import type {
  InferencePlatform,
  InferenceProvider,
  InferenceProviderId,
  InferenceRunStats,
} from './inference/types';
import {generateWithProviders, resolveProviderChain} from './inference/providerResolver';
import {createExistingProviders} from './inference/existingProviders';
import {cloudLlmService} from './cloudLlmService';
import {connectivityService} from './connectivityService';
import {llmService} from './llmService';
import {getSecureStore} from './secureStorage';

export type Mode = 'offline-only' | 'prefer-online' | 'prefer-offline' | 'demo';
export type UserMode = Exclude<Mode, 'demo'>;

const VALID_MODES: ReadonlyArray<Mode> = [
  'offline-only',
  'prefer-online',
  'prefer-offline',
  'demo',
];

function isMode(value: unknown): value is Mode {
  return typeof value === 'string' && (VALID_MODES as readonly string[]).includes(value);
}

function isUserMode(value: unknown): value is UserMode {
  return isMode(value) && value !== 'demo';
}

const userPreferences = () => getSecureStore('user-prefs');
const USER_LLM_MODE_KEY = 'user-llm-mode';
let requestSequence = 0;
let inferenceProviders = createExistingProviders();

export function registerInferenceProvider(provider: InferenceProvider): void {
  inferenceProviders = [
    ...inferenceProviders.filter(candidate => candidate.id !== provider.id),
    provider,
  ];
}

export function getInferenceProviders(): readonly InferenceProvider[] {
  return inferenceProviders;
}

export function resolveConfigMode(llm: unknown): Mode {
  const block = (llm ?? {}) as {mode?: unknown};
  if (isMode(block.mode)) return block.mode;
  return 'prefer-offline';
}

export function getConfigMode(): Mode {
  return resolveConfigMode(config.llm as LlmSection | undefined);
}

export function getMode(): Mode {
  const configMode = getConfigMode();
  if (configMode === 'demo') return 'demo';
  const override = userPreferences().getString(USER_LLM_MODE_KEY);
  return isUserMode(override) ? override : configMode;
}

export function setUserMode(mode: UserMode | null): void {
  if (mode === null) {
    userPreferences().remove(USER_LLM_MODE_KEY);
    return;
  }
  if (isUserMode(mode)) userPreferences().set(USER_LLM_MODE_KEY, mode);
}

export interface LlmRouteResult {
  text: string;
  source: 'local' | 'cloud';
  providerId: InferenceProviderId;
  modelIdentity?: string;
  stats?: InferenceRunStats;
}

function currentPlatform(): InferencePlatform {
  return Platform.OS === 'ios' ? 'ios' : 'android';
}

function currentLocale(): string {
  const language = config.locale?.language ?? 'en';
  const region = config.locale?.region;
  return region ? `${language}-${region}` : language;
}

function activePolicy() {
  return providerPolicyFromConfig(
    {...config.llm, mode: getMode()},
    currentPlatform(),
    currentLocale(),
  );
}

export function localAvailable(): boolean {
  return llmService.isLoaded();
}

export function cloudAvailable(): boolean {
  return cloudLlmService.isAvailable() && connectivityService.isOnline();
}

export async function generationAvailable(): Promise<boolean> {
  const providers = resolveProviderChain(inferenceProviders, activePolicy());
  const states = await Promise.all(providers.map(provider => provider.getCapabilities()));
  return states.some(state => state.state === 'available');
}

export async function routeGeneration(
  systemPrompt: string,
  userMessage: string,
  onToken?: (token: string) => void,
): Promise<LlmRouteResult> {
  requestSequence += 1;
  const result = await generateWithProviders(
    {
      requestId: `airgap-${Date.now()}-${requestSequence}`,
      systemPrompt,
      userMessage,
      onToken,
    },
    inferenceProviders,
    activePolicy(),
  );
  return {
    text: result.text,
    source: result.locality,
    providerId: result.providerId,
    modelIdentity: result.modelIdentity,
    stats: result.stats,
  };
}
