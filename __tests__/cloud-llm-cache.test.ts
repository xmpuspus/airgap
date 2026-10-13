jest.mock('../src/config/loader', () => ({
  config: {
    backend: {baseUrl: 'https://bff.example'},
    llm: {
      cacheByKbVersion: false,
      cloud: {enabled: true, endpoint: 'https://bff.example/api/v1/llm/generate'},
    },
  },
}));
jest.mock('../src/services/connectivityService', () => ({
  connectivityService: {isOnline: jest.fn(() => true)},
}));
// Prompts that contain "collide" share one hash, so only a full-string key stays correct.
jest.mock('../src/utils/hash', () => {
  const actual = jest.requireActual('../src/utils/hash');
  return {
    ...actual,
    fnv1a32: (text: string) => (text.includes('collide') ? 'same' : actual.fnv1a32(text)),
  };
});

import {
  clearAccessTokenProviderForTests,
  installAccessTokenProvider,
} from '../src/services/authProvider';
import {CloudLLMService} from '../src/services/cloudLlmService';

describe('cloud LLM response cache', () => {
  beforeEach(() => {
    clearAccessTokenProviderForTests();
    installAccessTokenProvider({getAccessToken: async () => 'token'});
    global.fetch = jest.fn().mockImplementation(async (_url: string, init: {body: string}) => ({
      ok: true,
      status: 200,
      json: async () => ({text: `answer to ${JSON.parse(init.body).user}`}),
    })) as jest.Mock;
  });

  afterEach(() => jest.restoreAllMocks());

  it('keeps answers apart when two prompts would share a short hash', async () => {
    const service = new CloudLLMService();

    const first = await service.generate('system', 'collide-one');
    const second = await service.generate('system', 'collide-two');

    expect(first).toBe('answer to collide-one');
    expect(second).toBe('answer to collide-two');
  });

  it('keeps an entry that was read recently when the cache is full', async () => {
    const service = new CloudLLMService();

    await service.generate('system', 'recent');
    for (let i = 0; i < 99; i += 1) await service.generate('system', `filler-${i}`);
    await service.generate('system', 'recent');
    await service.generate('system', 'overflow');
    (global.fetch as jest.Mock).mockClear();
    await service.generate('system', 'recent');

    expect(global.fetch).not.toHaveBeenCalled();
  });
});
