// Online actions use the template's own brand and hotline. A request the app
// cannot complete says so, instead of a promise of a follow-up that never comes.

jest.mock('react-native-fs', () => require('./helpers/rn-mocks').rnFs());
jest.mock('react-native-mmkv', () => require('./helpers/rn-mocks').rnMmkv());
jest.mock('../src/services/connectivityService', () =>
  require('./helpers/rn-mocks').connectivity(),
);
jest.mock('../src/services/secureStorage', () => require('./helpers/rn-mocks').secureStorage());
jest.mock('uuid', () => ({v4: () => 'test-id'}));

let mockActionType = 'account_action';
jest.mock('../src/utils/onlineCheck', () => ({
  requiresOnline: () => true,
  getOnlineActionType: () => mockActionType,
}));

const mockBackend = {checkBalance: jest.fn()};
jest.mock('../src/services/backendConnector', () => ({
  ...jest.requireActual('../src/services/backendConnector'),
  getBackendConnector: () => mockBackend,
}));

import {brand} from '../src/config/loader';
import {connectivityService} from '../src/services/connectivityService';
import {logger} from '../src/services/logger';
import {clearConversationHistory, processMessage} from '../src/services/orchestrator';

const PROMPT = 'please handle my request';

describe('online actions', () => {
  const originalBrand = {...brand};

  beforeEach(() => {
    clearConversationHistory();
    (connectivityService.isOnline as jest.Mock).mockReturnValue(true);
  });

  afterEach(() => {
    Object.assign(brand, originalBrand);
  });

  it('names the template brand and hotline for an account change', async () => {
    mockActionType = 'account_action';
    Object.assign(brand, {
      name: 'Northwind Water',
      hotline: '1800-555-0199',
      hotlineLabel: 'toll-free',
    });

    const response = await processMessage(PROMPT);

    expect(response.text).toContain('visit any Northwind Water store');
    expect(response.text).toContain('call 1800-555-0199 (toll-free)');
    expect(response.text).not.toContain('ACME');
    expect(response.text).not.toContain('211');
  });

  it('leaves out an empty hotline label', async () => {
    mockActionType = 'account_action';
    Object.assign(brand, {name: 'Northwind Water', hotline: '1800-555-0199', hotlineLabel: ''});

    const response = await processMessage(PROMPT);

    expect(response.text).toContain('call 1800-555-0199 or visit');
    expect(response.text).not.toContain('()');
  });

  it('logs a failed backend call and says the request did not complete', async () => {
    mockActionType = 'balance_check';
    mockBackend.checkBalance.mockRejectedValue(new Error('backend down'));
    const warn = jest.spyOn(logger, 'warn');

    const response = await processMessage(PROMPT);
    const calls = [...warn.mock.calls];
    warn.mockRestore();

    expect(calls).toContainEqual([
      'orchestrator',
      expect.any(String),
      expect.objectContaining({actionType: 'balance_check', err: 'Error: backend down'}),
    ]);
    expect(response.text).toContain('I could not complete that request');
    expect(response.text).toContain(brand.hotline);
    expect(response.text).not.toContain('Let me look into that');
  });

  it('says the request did not complete for an action it has no handler for', async () => {
    mockActionType = 'pigeon_post';

    const response = await processMessage(PROMPT);

    expect(response.text).toContain('I could not complete that request');
    expect(response.text).not.toContain('Let me look into that');
  });
});
