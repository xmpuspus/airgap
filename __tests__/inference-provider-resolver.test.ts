import {
  generateWithProviders,
  InferenceProviderError,
  resolveProviderChain,
} from '../src/services/inference/providerResolver';
import type {
  InferenceCapabilities,
  InferenceProvider,
  InferenceProviderId,
  ProviderFailureReason,
  ProviderPolicy,
} from '../src/services/inference/types';

const request = {
  requestId: 'request-1',
  systemPrompt: 'Use only the supplied support documents.',
  userMessage: 'Grounded support question',
};

function fakeProvider(
  id: InferenceProviderId,
  options: {
    state?: InferenceCapabilities['state'];
    locality?: InferenceCapabilities['locality'];
    failure?: ProviderFailureReason;
    text?: string;
    osVersion?: string;
  } = {},
): InferenceProvider {
  const locality = options.locality ?? (id === 'cloud' ? 'cloud' : 'local');
  return {
    id,
    getCapabilities: jest.fn(async () => ({
      providerId: id,
      state: options.state ?? 'available',
      locality,
      supportsStreaming: true,
      supportsCancellation: true,
      modelIdentity: `${id}-model`,
      osVersion: options.osVersion,
    })),
    generate: jest.fn(async () => {
      if (options.failure) {
        throw new InferenceProviderError(options.failure, `failed: ${options.failure}`, id);
      }
      return {
        text: options.text ?? id,
        providerId: id,
        locality,
        modelIdentity: `${id}-model`,
      };
    }),
    cancel: jest.fn(async () => {}),
    getLastRunStats: () => null,
  };
}

function policy(
  mode: ProviderPolicy['mode'],
  ids: InferenceProviderId[],
  overrides: Partial<ProviderPolicy> = {},
): ProviderPolicy {
  return {
    mode,
    platform: 'ios',
    domain: 'telco',
    locale: 'en-US',
    providers: ids.map((id, priority) => ({id, enabled: true, priority})),
    ...overrides,
  };
}

describe('inference provider resolver', () => {
  test('uses ready providers in operator priority order', async () => {
    const downloaded = fakeProvider('llama-rn');
    const apple = fakeProvider('apple-foundation-models');

    const result = await generateWithProviders(
      request,
      [downloaded, apple],
      policy('prefer-offline', ['apple-foundation-models', 'llama-rn']),
    );

    expect(result.providerId).toBe('apple-foundation-models');
    expect(downloaded.generate).not.toHaveBeenCalled();
  });

  test.each<ProviderFailureReason>([
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
  ])('falls back after %s', async failure => {
    const first = fakeProvider('apple-foundation-models', {failure});
    const fallback = fakeProvider('llama-rn');

    const result = await generateWithProviders(
      request,
      [first, fallback],
      policy('prefer-offline', ['apple-foundation-models', 'llama-rn']),
    );

    expect(result.providerId).toBe('llama-rn');
  });

  test('does not fall back after cancellation', async () => {
    const first = fakeProvider('apple-foundation-models', {failure: 'cancelled'});
    const fallback = fakeProvider('llama-rn');

    await expect(
      generateWithProviders(
        request,
        [first, fallback],
        policy('prefer-offline', ['apple-foundation-models', 'llama-rn']),
      ),
    ).rejects.toMatchObject({reason: 'cancelled'});
    expect(fallback.generate).not.toHaveBeenCalled();
  });

  test('offline-only excludes cloud even when it is first', async () => {
    const cloud = fakeProvider('cloud');

    await expect(
      generateWithProviders(request, [cloud], policy('offline-only', ['cloud'])),
    ).rejects.toMatchObject({reason: 'model_not_ready'});
    expect(cloud.getCapabilities).not.toHaveBeenCalled();
  });

  test('operator policy overrides domain and user preference', () => {
    const cloud = fakeProvider('cloud');
    const local = fakeProvider('llama-rn');
    const selected = resolveProviderChain(
      [cloud, local],
      policy('prefer-online', ['cloud', 'llama-rn'], {
        providers: [
          {
            id: 'cloud',
            enabled: true,
            priority: 0,
            blockedDomains: ['telco'],
          },
          {id: 'llama-rn', enabled: true, priority: 1},
        ],
      }),
    );

    expect(selected.map(provider => provider.id)).toEqual(['llama-rn']);
  });

  test('skips a provider below the operator minimum OS version', async () => {
    const apple = fakeProvider('apple-foundation-models', {osVersion: '25.5'});
    const downloaded = fakeProvider('llama-rn');
    const currentPolicy = policy('prefer-offline', ['apple-foundation-models', 'llama-rn'], {
      providers: [
        {
          id: 'apple-foundation-models',
          enabled: true,
          priority: 0,
          minimumOsVersion: '26.0',
        },
        {id: 'llama-rn', enabled: true, priority: 1},
      ],
    });

    await expect(
      generateWithProviders(request, [apple, downloaded], currentPolicy),
    ).resolves.toMatchObject({providerId: 'llama-rn'});
    expect(apple.generate).not.toHaveBeenCalled();
  });

  test('does not select cloud when cloud fallback is disabled', () => {
    const cloud = fakeProvider('cloud');
    const downloaded = fakeProvider('llama-rn');
    const selected = resolveProviderChain(
      [cloud, downloaded],
      policy('prefer-online', ['cloud', 'llama-rn'], {
        providers: [
          {id: 'cloud', enabled: true, priority: 0, allowCloudFallback: false},
          {id: 'llama-rn', enabled: true, priority: 1},
        ],
      }),
    );

    expect(selected.map(provider => provider.id)).toEqual(['llama-rn']);
  });

  test('checks capabilities again for every request', async () => {
    const apple = fakeProvider('apple-foundation-models');
    const currentPolicy = policy('prefer-offline', ['apple-foundation-models']);

    await generateWithProviders(request, [apple], currentPolicy);
    await generateWithProviders({...request, requestId: 'request-2'}, [apple], currentPolicy);

    expect(apple.getCapabilities).toHaveBeenCalledTimes(2);
  });

  test('rejects concurrent generation on the same provider', async () => {
    let release: (() => void) | undefined;
    const apple = fakeProvider('apple-foundation-models');
    apple.generate = jest.fn(
      () =>
        new Promise(resolve => {
          release = () =>
            resolve({
              text: 'done',
              providerId: 'apple-foundation-models',
              locality: 'local',
            });
        }),
    );
    const currentPolicy = policy('prefer-offline', ['apple-foundation-models']);
    const first = generateWithProviders(request, [apple], currentPolicy);

    await expect(
      generateWithProviders({...request, requestId: 'request-2'}, [apple], currentPolicy),
    ).rejects.toMatchObject({reason: 'busy'});
    release?.();
    await expect(first).resolves.toMatchObject({text: 'done'});
  });
});
