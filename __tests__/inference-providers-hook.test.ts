import {
  readConfiguredProviderCapabilities,
  selectProviderEntriesForMode,
} from '../src/services/inference/providerReadiness';
import type {
  InferenceCapabilities,
  InferenceProvider,
  InferenceProviderId,
  ProviderPolicyEntry,
} from '../src/services/inference/types';

function provider(
  id: InferenceProviderId,
  capabilities: Partial<InferenceCapabilities> = {},
): InferenceProvider {
  return {
    id,
    getCapabilities: jest.fn(async (): Promise<InferenceCapabilities> => {
      const base: InferenceCapabilities = {
        providerId: id,
        state: 'available',
        locality: id === 'cloud' ? 'cloud' : 'local',
        supportsStreaming: true,
        supportsCancellation: true,
      };
      return {...base, ...capabilities};
    }),
    generate: jest.fn(),
    cancel: jest.fn(),
    getLastRunStats: jest.fn(() => null),
  };
}

test('reads the configured platform chain in priority order and keeps disabled entries visible', async () => {
  const apple = provider('apple-foundation-models');
  const android = provider('android-aicore');
  const llama = provider('llama-rn');
  const entries: ProviderPolicyEntry[] = [
    {id: 'llama-rn', enabled: false, priority: 10, platform: 'all'},
    {id: 'android-aicore', enabled: true, priority: 0, platform: 'android'},
    {id: 'apple-foundation-models', enabled: true, priority: 0, platform: 'ios'},
  ];

  const result = await readConfiguredProviderCapabilities('ios', [llama, android, apple], entries);

  expect(result.map(item => [item.providerId, item.state])).toEqual([
    ['apple-foundation-models', 'available'],
    ['llama-rn', 'disabled'],
  ]);
  expect(llama.getCapabilities).not.toHaveBeenCalled();
  expect(android.getCapabilities).not.toHaveBeenCalled();
});

test('turns a capability-check failure into a usable unavailable state', async () => {
  const apple = provider('apple-foundation-models');
  (apple.getCapabilities as jest.Mock).mockRejectedValue(new Error('native bridge failed'));

  await expect(
    readConfiguredProviderCapabilities(
      'ios',
      [apple],
      [{id: 'apple-foundation-models', enabled: true, priority: 0, platform: 'ios'}],
    ),
  ).resolves.toEqual([
    expect.objectContaining({
      providerId: 'apple-foundation-models',
      state: 'unavailable',
      reason: 'generation_failed',
    }),
  ]);
});

test('shows operator-blocked downloads as unavailable', async () => {
  const android = provider('android-aicore', {
    state: 'downloadable',
    reason: 'download_required',
    osVersion: '36',
  });

  await expect(
    readConfiguredProviderCapabilities(
      'android',
      [android],
      [
        {
          id: 'android-aicore',
          enabled: true,
          priority: 0,
          allowModelDownload: false,
        },
      ],
    ),
  ).resolves.toEqual([
    expect.objectContaining({
      providerId: 'android-aicore',
      state: 'unavailable',
      reason: 'provider_disabled',
    }),
  ]);
});

test('shows a provider below the configured OS floor as unavailable', async () => {
  const apple = provider('apple-foundation-models', {osVersion: '25.5'});

  await expect(
    readConfiguredProviderCapabilities(
      'ios',
      [apple],
      [
        {
          id: 'apple-foundation-models',
          enabled: true,
          priority: 0,
          minimumOsVersion: '26.0',
        },
      ],
    ),
  ).resolves.toEqual([
    expect.objectContaining({
      providerId: 'apple-foundation-models',
      state: 'unavailable',
      reason: 'unsupported_os',
    }),
  ]);
});

test('shows only document answers when demo mode owns the active provider chain', () => {
  const entries: ProviderPolicyEntry[] = [
    {id: 'apple-foundation-models', enabled: true, priority: 0, platform: 'ios'},
    {id: 'llama-rn', enabled: true, priority: 10, platform: 'all'},
    {id: 'demo', enabled: true, priority: 30, platform: 'all'},
  ];

  expect(selectProviderEntriesForMode('demo', entries)).toEqual([
    {id: 'demo', enabled: true, priority: 30, platform: 'all'},
  ]);
  expect(selectProviderEntriesForMode('offline-only', entries)).toEqual(entries);
});
