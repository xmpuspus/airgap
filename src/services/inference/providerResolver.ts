import type {
  InferenceCapabilities,
  InferenceProvider,
  InferenceProviderId,
  InferenceRequest,
  InferenceResult,
  ProviderFailureReason,
  ProviderPolicy,
  ProviderPolicyEntry,
} from './types';

const FALLBACK_FAILURES = new Set<ProviderFailureReason>([
  'unsupported_device',
  'unsupported_os',
  'unsupported_locale',
  'provider_disabled',
  'model_not_ready',
  'download_required',
  'busy',
  'quota_exceeded',
  'background_blocked',
  'context_exceeded',
  'generation_failed',
]);

const activeProviders = new WeakSet<InferenceProvider>();

export class InferenceProviderError extends Error {
  readonly reason: ProviderFailureReason;
  readonly providerId?: InferenceProviderId;

  constructor(reason: ProviderFailureReason, message: string, providerId?: InferenceProviderId) {
    super(message);
    this.name = 'InferenceProviderError';
    this.reason = reason;
    this.providerId = providerId;
  }
}

function includesCaseInsensitive(values: string[] | undefined, value: string | undefined): boolean {
  if (!values || values.length === 0) return true;
  if (!value) return false;
  const normalized = value.toLowerCase();
  return values.some(item => item.toLowerCase() === normalized);
}

function entryAllows(entry: ProviderPolicyEntry, policy: ProviderPolicy): boolean {
  if (!entry.enabled) return false;
  if (entry.platform && entry.platform !== 'all' && entry.platform !== policy.platform)
    return false;
  if (entry.allowedDomains && !includesCaseInsensitive(entry.allowedDomains, policy.domain)) {
    return false;
  }
  if (
    policy.domain &&
    entry.blockedDomains?.some(domain => domain.toLowerCase() === policy.domain?.toLowerCase())
  ) {
    return false;
  }
  if (entry.locales && !includesCaseInsensitive(entry.locales, policy.locale)) return false;
  if (policy.mode === 'offline-only' && entry.id === 'cloud') return false;
  if (policy.mode === 'demo' && entry.id !== 'demo') return false;
  if (policy.mode !== 'demo' && entry.id === 'demo') return false;
  return true;
}

export function resolveProviderChain(
  providers: InferenceProvider[],
  policy: ProviderPolicy,
): InferenceProvider[] {
  const availableById = new Map(providers.map(provider => [provider.id, provider]));
  return [...policy.providers]
    .filter(entry => entryAllows(entry, policy))
    .sort((left, right) => left.priority - right.priority)
    .flatMap(entry => {
      const provider = availableById.get(entry.id);
      return provider ? [provider] : [];
    });
}

function unavailableReason(capabilities: InferenceCapabilities): ProviderFailureReason {
  if (capabilities.reason) return capabilities.reason;
  if (capabilities.state === 'disabled') return 'provider_disabled';
  if (capabilities.state === 'downloadable') return 'download_required';
  return 'model_not_ready';
}

function normalizedError(error: unknown, providerId: InferenceProviderId): InferenceProviderError {
  if (error instanceof InferenceProviderError) return error;
  return new InferenceProviderError('generation_failed', String(error), providerId);
}

export async function generateWithProviders(
  request: InferenceRequest,
  providers: InferenceProvider[],
  policy: ProviderPolicy,
): Promise<InferenceResult> {
  const failures: InferenceProviderError[] = [];

  for (const provider of resolveProviderChain(providers, policy)) {
    const capabilities = await provider.getCapabilities();
    if (capabilities.state !== 'available') {
      failures.push(
        new InferenceProviderError(
          unavailableReason(capabilities),
          `${provider.id} is ${capabilities.state}`,
          provider.id,
        ),
      );
      continue;
    }
    if (activeProviders.has(provider)) {
      failures.push(new InferenceProviderError('busy', `${provider.id} is busy`, provider.id));
      continue;
    }

    const cancel = () => {
      provider.cancel(request.requestId).catch(() => undefined);
    };
    request.signal?.addEventListener('abort', cancel, {once: true});
    activeProviders.add(provider);
    try {
      return await provider.generate(request);
    } catch (error) {
      const failure = normalizedError(error, provider.id);
      if (!FALLBACK_FAILURES.has(failure.reason)) throw failure;
      failures.push(failure);
    } finally {
      activeProviders.delete(provider);
      request.signal?.removeEventListener('abort', cancel);
    }
  }

  const lastFailure = failures.at(-1);
  throw new InferenceProviderError(
    lastFailure?.reason === 'busy' ? 'busy' : 'model_not_ready',
    lastFailure?.message ?? 'No permitted provider is ready',
    lastFailure?.providerId,
  );
}
