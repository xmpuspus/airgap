// A tool runs the backend method that matches its name. A method without a
// dedicated connector call goes to executeAction, so a booking never gets the
// outage reply.

jest.mock('react-native-mmkv', () => require('./helpers/rn-mocks').rnMmkv());
jest.mock('../src/services/connectivityService', () =>
  require('./helpers/rn-mocks').connectivity(),
);
jest.mock('../src/services/secureStorage', () => require('./helpers/rn-mocks').secureStorage());
jest.mock('uuid', () => ({v4: () => 'queued-1'}));

const mockBackend = {
  checkBalance: jest.fn(),
  changePlan: jest.fn(),
  createTicket: jest.fn(),
  checkOutage: jest.fn(),
  executeAction: jest.fn(),
};
jest.mock('../src/services/backendConnector', () => ({
  getBackendConnector: () => mockBackend,
}));

import {brand} from '../src/config/loader';
import {connectivityService} from '../src/services/connectivityService';
import {offlineQueue} from '../src/services/offlineQueue';
import {executeTool, type ToolDefinition} from '../src/services/tools';

const QUERY = 'Book appointment with cardiology';

function tool(overrides: Partial<ToolDefinition>): ToolDefinition {
  return {
    name: 'bookAppointment',
    description: 'Book an appointment',
    keywords: ['book appointment'],
    ...overrides,
  };
}

function setOnline(online: boolean) {
  (connectivityService.isOnline as jest.Mock).mockReturnValue(online);
}

describe('tool execution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    offlineQueue.clear();
    setOnline(true);
    mockBackend.executeAction.mockResolvedValue({message: 'Appointment booked.'});
    mockBackend.checkOutage.mockResolvedValue({hasOutage: false, message: 'No outage.'});
    mockBackend.checkBalance.mockResolvedValue({balance: 'PHP 10', data: '1GB', promos: 'none'});
  });

  it.each([
    'bookAppointment',
    'scheduleCallback',
    'scheduleMeterRead',
    'requestCallback',
    'lookupFlightStatus',
    'checkPolicyStatus',
    'checkBillStatus',
  ])('sends %s to executeAction instead of the outage check', async method => {
    const result = await executeTool(tool({name: method}), QUERY);

    expect(mockBackend.executeAction).toHaveBeenCalledWith(method, {query: QUERY}, undefined);
    expect(mockBackend.checkOutage).not.toHaveBeenCalled();
    expect(result.summary).toBe('Appointment booked.');
  });

  it.each(['checkOutage', 'reportOutage'])('keeps %s on the outage check', async method => {
    const result = await executeTool(tool({name: method}), 'Is there an outage');

    expect(mockBackend.checkOutage).toHaveBeenCalled();
    expect(mockBackend.executeAction).not.toHaveBeenCalled();
    expect(result.summary).toBe('No outage.');
  });

  it('runs a read-only tool offline when the tool does not opt out of the queue', async () => {
    setOnline(false);

    const result = await executeTool(tool({name: 'checkBalance', stateChanging: false}), 'balance');

    expect(result.error).toBeUndefined();
    expect(mockBackend.checkBalance).toHaveBeenCalled();
  });

  it('queues a state-changing tool offline when the tool does not opt out', async () => {
    setOnline(false);

    const result = await executeTool(tool({stateChanging: true}), QUERY);

    expect(result.queuedActionId).toBe('queued-1');
    expect(mockBackend.executeAction).not.toHaveBeenCalled();
  });

  it('fails a tool that opts out of the queue while offline', async () => {
    setOnline(false);

    const result = await executeTool(
      tool({stateChanging: true, offlineQueueEligible: false}),
      QUERY,
    );

    expect(result.error).toBe('offline_not_eligible');
    expect(offlineQueue.getQueue()).toEqual([]);
  });

  it('names the real hotline when the backend call fails', async () => {
    mockBackend.executeAction.mockRejectedValue(new Error('down'));

    const result = await executeTool(tool({}), QUERY);

    expect(result.ok).toBe(false);
    expect(result.error).toBe('down');
    expect(result.summary).toBe(
      `I could not complete that request right now. Please try again later or call ${brand.hotline}.`,
    );
  });

  it('replays a queued tool with the backend method it uses online', async () => {
    setOnline(false);
    const queued = await executeTool(
      tool({name: 'createTicket', stateChanging: true}),
      'Create a support ticket',
    );
    setOnline(true);
    mockBackend.createTicket.mockResolvedValue({ticketId: 'T1', message: 'Ticket T1 created.'});

    const [replayed] = await offlineQueue.processQueue();

    expect(mockBackend.createTicket).toHaveBeenCalledWith('Create a support ticket', {
      idempotencyKey: queued.queuedActionId,
    });
    expect(mockBackend.executeAction).not.toHaveBeenCalled();
    expect(replayed.response).toBe('Ticket T1 created.');
  });
});
