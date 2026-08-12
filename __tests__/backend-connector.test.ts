jest.mock('../src/services/secureStorage', () => require('./helpers/rn-mocks').secureStorage());

import {
  clearAccessTokenProviderForTests,
  installAccessTokenProvider,
} from '../src/services/authProvider';
import {RestBackendConnector, type KbManifest} from '../src/services/backendConnector';

const jsonResponse = (body: unknown) => ({
  ok: true,
  status: 200,
  headers: {get: () => 'application/json'},
  json: async () => body,
});

describe('REST backend connector', () => {
  beforeEach(() => {
    clearAccessTokenProviderForTests();
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({hasOutage: false, message: 'No outage'})) as jest.Mock;
  });

  afterEach(() => jest.restoreAllMocks());

  it('gets a new token for each request', async () => {
    const getAccessToken = jest.fn().mockResolvedValueOnce('one').mockResolvedValueOnce('two');
    installAccessTokenProvider({getAccessToken});
    const connector = new RestBackendConnector('https://bff.example', {
      audience: 'support-api',
    });

    await connector.checkOutage();
    await connector.checkOutage();

    expect(getAccessToken).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      'https://bff.example/api/v1/outages',
      expect.objectContaining({
        headers: expect.objectContaining({Authorization: 'Bearer one'}),
      }),
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      'https://bff.example/api/v1/outages',
      expect.objectContaining({
        headers: expect.objectContaining({Authorization: 'Bearer two'}),
      }),
    );
  });

  it('does not call the network without an installed token provider', async () => {
    const connector = new RestBackendConnector('https://bff.example');

    await expect(connector.checkOutage()).rejects.toThrow('auth_provider_not_installed');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('downloads exact bundle bytes with a fresh access token', async () => {
    const manifest = {
      algorithm: 'Ed25519',
      signatureEncoding: 'base64',
      byteLength: 3,
      sha256: '0'.repeat(64),
      version: '2',
      keyId: '0123456789abcdef',
      url: 'https://bff.example/api/v1/sync/kb/download',
      publishedAt: '2026-08-12T00:00:00.000Z',
      signature: 'x',
    } as KbManifest;
    installAccessTokenProvider({getAccessToken: jest.fn().mockResolvedValue('bundle-token')});
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {get: () => 'application/json'},
      arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer,
    }) as jest.Mock;
    const connector = new RestBackendConnector('https://bff.example');

    await expect(connector.fetchKbBytes(manifest)).resolves.toEqual(Uint8Array.from([1, 2, 3]));
    expect(global.fetch).toHaveBeenCalledWith(
      manifest.url,
      expect.objectContaining({
        headers: expect.objectContaining({Authorization: 'Bearer bundle-token'}),
      }),
    );
  });

  it('does not send a token to a bundle URL on another origin', async () => {
    const connector = new RestBackendConnector('https://bff.example');
    const manifest = {
      url: 'https://files.example/bundle.json',
    } as KbManifest;

    await expect(connector.fetchKbBytes(manifest)).rejects.toThrow('bundle_url_origin_invalid');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
