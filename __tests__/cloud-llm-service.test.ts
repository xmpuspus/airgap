jest.mock('../src/config/loader', () => ({
  config: {
    backend: {baseUrl: 'https://bff.example'},
    llm: {
      cacheByKbVersion: false,
      cloud: {
        audience: 'cloud-api',
        enabled: true,
        endpoint: 'https://bff.example/api/v1/llm/generate',
      },
    },
  },
}));
jest.mock('../src/services/connectivityService', () => ({
  connectivityService: {isOnline: jest.fn(() => true)},
}));

import {
  clearAccessTokenProviderForTests,
  installAccessTokenProvider,
} from '../src/services/authProvider';
import {CloudLLMService} from '../src/services/cloudLlmService';

describe('cloud LLM authentication', () => {
  beforeEach(() => {
    clearAccessTokenProviderForTests();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({text: 'Grounded response'}),
    }) as jest.Mock;
  });

  afterEach(() => jest.restoreAllMocks());

  it('gets a short-lived token for each cloud request', async () => {
    const getAccessToken = jest
      .fn()
      .mockResolvedValueOnce('cloud-one')
      .mockResolvedValueOnce('cloud-two');
    installAccessTokenProvider({getAccessToken});
    const service = new CloudLLMService();

    await service.generate('system', 'first');
    await service.generate('system', 'second');

    expect(getAccessToken).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({Authorization: 'Bearer cloud-one'}),
      }),
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({Authorization: 'Bearer cloud-two'}),
      }),
    );
  });
});
