import type {
  InferenceCapabilities,
  InferencePlatform,
  InferenceProvider,
  ProviderPolicyEntry,
} from './types';

function unavailableCapabilities(
  entry: ProviderPolicyEntry,
  platform: InferencePlatform,
): InferenceCapabilities {
  return {
    providerId: entry.id,
    state: entry.enabled ? 'unavailable' : 'disabled',
    locality: entry.id === 'cloud' ? 'cloud' : 'local',
    supportsStreaming: entry.id !== 'demo',
    supportsCancellation: entry.id !== 'demo',
    platform: entry.platform === 'all' || !entry.platform ? platform : entry.platform,
    reason: entry.enabled ? 'generation_failed' : 'provider_disabled',
  };
}

export async function readConfiguredProviderCapabilities(
  platform: InferencePlatform,
  providers: readonly InferenceProvider[],
  entries: readonly ProviderPolicyEntry[],
): Promise<InferenceCapabilities[]> {
  const providersById = new Map(providers.map(provider => [provider.id, provider]));
  const orderedEntries = [...entries]
    .filter(entry => !entry.platform || entry.platform === 'all' || entry.platform === platform)
    .sort((left, right) => left.priority - right.priority);

  return Promise.all(
    orderedEntries.map(async entry => {
      if (!entry.enabled) return unavailableCapabilities(entry, platform);
      const provider = providersById.get(entry.id);
      if (!provider) return unavailableCapabilities(entry, platform);
      try {
        return await provider.getCapabilities();
      } catch {
        return unavailableCapabilities(entry, platform);
      }
    }),
  );
}
