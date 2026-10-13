jest.mock('react-native-fs', () => require('./helpers/rn-mocks').rnFs());
jest.mock('react-native-mmkv', () => require('./helpers/rn-mocks').rnMmkv());
jest.mock('../src/services/connectivityService', () =>
  require('./helpers/rn-mocks').connectivity(),
);
jest.mock('../src/services/secureStorage', () => require('./helpers/rn-mocks').secureStorage());
jest.mock('uuid', () => ({v4: () => 'test-id'}));

import {config} from '../src/config/loader';
import {generationAvailable, registerInferenceProvider} from '../src/services/llmRouter';
import type {InferenceCapabilities, InferenceProvider} from '../src/services/inference/types';

function provider(
  id: 'llama-rn' | 'apple-foundation-models',
  capabilities: () => Promise<InferenceCapabilities>,
): InferenceProvider {
  return {
    id,
    getCapabilities: capabilities,
    generate: jest.fn(),
    cancel: jest.fn(),
    getLastRunStats: () => null,
  };
}

describe('generation availability', () => {
  const previous = config.llm;

  beforeEach(() => {
    config.llm = {
      mode: 'offline-only',
      providers: [
        {id: 'llama-rn', enabled: true, priority: 0, platform: 'all'},
        {id: 'apple-foundation-models', enabled: true, priority: 1, platform: 'all'},
      ],
    };
  });

  afterEach(() => {
    config.llm = previous;
  });

  it('stays true when one provider rejects and another is available', async () => {
    registerInferenceProvider(
      provider('llama-rn', async () => {
        throw new Error('native bridge failed');
      }),
    );
    registerInferenceProvider(
      provider('apple-foundation-models', async () => ({
        providerId: 'apple-foundation-models',
        state: 'available',
        locality: 'local',
        supportsStreaming: false,
        supportsCancellation: false,
      })),
    );

    await expect(generationAvailable()).resolves.toBe(true);
  });

  it('is false when the only provider rejects', async () => {
    config.llm = {
      mode: 'offline-only',
      providers: [{id: 'llama-rn', enabled: true, priority: 0, platform: 'all'}],
    };
    registerInferenceProvider(
      provider('llama-rn', async () => {
        throw new Error('native bridge failed');
      }),
    );

    await expect(generationAvailable()).resolves.toBe(false);
  });
});
