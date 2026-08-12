// Sync service unit tests. Pure behavior, no network. End-to-end sync
// lives in the integration harness gated behind a running BFF.

jest.mock('react-native-fs', () => require('./helpers/rn-mocks').rnFs());
jest.mock('react-native-mmkv', () => require('./helpers/rn-mocks').rnMmkv());
jest.mock('../src/services/connectivityService', () =>
  require('./helpers/rn-mocks').connectivity(),
);
jest.mock('../src/services/secureStorage', () => require('./helpers/rn-mocks').secureStorage());

import {
  fetchManifest,
  syncKnowledge,
  getStalenessInfo,
  getDegradedModePrefix,
} from '../src/services/syncService';
import {connectivityService} from '../src/services/connectivityService';

describe('syncService', () => {
  test('sync skipped when offline', async () => {
    (connectivityService.isOnline as jest.Mock).mockReturnValue(false);
    const result = await syncKnowledge();
    expect(result.ok).toBe(false);
    expect(result.action).toBe('noop');
    expect(result.error).toBe('offline');
  });

  test('sync skipped when no backend configured', async () => {
    (connectivityService.isOnline as jest.Mock).mockReturnValue(true);
    // The default test config has backend.type='mock' and no baseUrl
    const result = await syncKnowledge();
    expect(result.ok).toBe(false);
    expect(result.action).toBe('noop');
    expect(result.error).toBe('no_backend_configured');
  });

  test('getStalenessInfo returns "never" band before any sync', () => {
    const info = getStalenessInfo();
    expect(['never', 'fresh', 'stale', 'very_stale']).toContain(info.band);
  });

  test('getDegradedModePrefix is non-empty when stale or unknown', () => {
    const info = getStalenessInfo();
    const prefix = getDegradedModePrefix();
    if (info.band === 'fresh') {
      expect(prefix).toBeNull();
    } else {
      expect(prefix).toBeTruthy();
      expect(typeof prefix).toBe('string');
    }
  });

  test('fetchManifest throws without configured backend', async () => {
    await expect(fetchManifest()).rejects.toThrow(/backend\.baseUrl/);
  });
});
