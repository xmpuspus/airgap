import {
  clearAccessTokenProviderForTests,
  getAccessToken,
  hasAccessTokenProvider,
  installAccessTokenProvider,
} from '../src/services/authProvider';

describe('access token provider', () => {
  beforeEach(() => clearAccessTokenProviderForTests());

  it('rejects requests before a provider is installed', async () => {
    expect(hasAccessTokenProvider()).toBe(false);
    await expect(getAccessToken('airgap-bff')).rejects.toThrow('auth_provider_not_installed');
  });

  it('gets a token for the requested audience', async () => {
    const provider = {getAccessToken: jest.fn().mockResolvedValue('short-lived')};
    installAccessTokenProvider(provider);

    await expect(getAccessToken('airgap-bff')).resolves.toBe('short-lived');
    expect(provider.getAccessToken).toHaveBeenCalledWith('airgap-bff');
    expect(hasAccessTokenProvider()).toBe(true);
  });

  it('rejects an empty token', async () => {
    installAccessTokenProvider({getAccessToken: jest.fn().mockResolvedValue('  ')});

    await expect(getAccessToken('airgap-bff')).rejects.toThrow('auth_token_missing');
  });
});
