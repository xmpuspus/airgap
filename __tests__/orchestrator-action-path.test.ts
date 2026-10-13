// A configured action that has no dedicated connector method still reaches the
// backend, online and from the outbox. An account change gets its answer at once.

jest.mock('react-native-fs', () => require('./helpers/rn-mocks').rnFs());
jest.mock('react-native-mmkv', () => require('./helpers/rn-mocks').rnMmkv());
jest.mock('../src/services/connectivityService', () =>
  require('./helpers/rn-mocks').connectivity(),
);
jest.mock('../src/services/secureStorage', () => require('./helpers/rn-mocks').secureStorage());
jest.mock('uuid', () => ({v4: () => 'test-id'}));

let mockActionType: string | null = 'prescription_refill';
jest.mock('../src/utils/onlineCheck', () => ({
  requiresOnline: () => true,
  getOnlineActionType: () => mockActionType,
}));

const mockBackend = {
  checkBalance: jest.fn(),
  changePlan: jest.fn(),
  createTicket: jest.fn(),
  checkOutage: jest.fn(),
  executeAction: jest.fn(),
};
jest.mock('../src/services/backendConnector', () => ({
  ...jest.requireActual('../src/services/backendConnector'),
  getBackendConnector: () => mockBackend,
}));

import {connectivityService} from '../src/services/connectivityService';
import {offlineQueue} from '../src/services/offlineQueue';
import {clearConversationHistory, processMessage} from '../src/services/orchestrator';

const PROMPT = 'please refill my prescription';

function setOnline(online: boolean) {
  (connectivityService.isOnline as jest.Mock).mockReturnValue(online);
}

describe('configured action path', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearConversationHistory();
    offlineQueue.clear();
    mockActionType = 'prescription_refill';
    mockBackend.executeAction.mockResolvedValue({message: 'Refill request sent.'});
  });

  it('sends an action without a dedicated method to executeAction when online', async () => {
    setOnline(true);

    const response = await processMessage(PROMPT);

    expect(mockBackend.executeAction).toHaveBeenCalledWith(
      'prescription_refill',
      {query: PROMPT},
      undefined,
    );
    expect(response.text).toBe('Refill request sent.');
  });

  it('replays a queued action through the backend instead of a fixed success text', async () => {
    setOnline(false);
    const queued = await processMessage(PROMPT);
    expect(queued.source).toBe('queue');
    setOnline(true);

    const [result] = await offlineQueue.processQueue();

    expect(mockBackend.executeAction).toHaveBeenCalledWith(
      'prescription_refill',
      {query: PROMPT},
      {idempotencyKey: queued.queuedActionId},
    );
    expect(result.action.status).toBe('completed');
    expect(result.response).toBe('Refill request sent.');
  });

  it('answers an account change at once while offline and does not queue it', async () => {
    setOnline(false);
    mockActionType = 'account_action';

    const response = await processMessage('cancel my account');

    expect(response.source).toBe('system');
    expect(response.queuedActionId).toBeUndefined();
    expect(response.text).toContain('require verification');
    expect(offlineQueue.getQueue()).toEqual([]);
    expect(mockBackend.executeAction).not.toHaveBeenCalled();
  });

  it('grounds a tool answer in the tool result document', async () => {
    setOnline(true);
    mockBackend.checkBalance.mockResolvedValue({
      balance: 'PHP 127.50',
      data: '3.2GB',
      promos: 'MegaSurf 299',
    });

    const response = await processMessage('What is my balance right now');

    expect(response.source).toBe('tool');
    expect(response.audit?.toolName).toBe('checkBalance');
    expect(response.audit?.kbDocIds).toEqual(['tool:checkBalance']);
    expect(response.text).toContain('PHP 127.50');
  });
});
