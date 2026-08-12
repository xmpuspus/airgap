const mockExecuteAction = jest.fn();

jest.mock('uuid', () => ({v4: jest.fn(() => 'queue-record-1')}));
jest.mock('react-native-mmkv', () => require('./helpers/rn-mocks').rnMmkv());
jest.mock('../src/services/secureStorage', () => require('./helpers/rn-mocks').secureStorage());
jest.mock('../src/services/backendConnector', () => ({
  getBackendConnector: () => ({executeAction: mockExecuteAction}),
}));
jest.mock('../src/config/loader', () => ({
  config: {queue: {maxRetries: 3}},
  actions: [],
  interpolate: (value: string) => value,
}));

import {offlineQueue} from '../src/services/offlineQueue';

describe('offline action queue', () => {
  beforeEach(() => {
    offlineQueue.clear();
    mockExecuteAction.mockReset();
  });

  test('marks a backend error as failed', async () => {
    mockExecuteAction.mockRejectedValue(new Error('down'));
    offlineQueue.enqueue('tool_call', 'Create a ticket', 'chat-1', 'create_ticket');

    const [result] = await offlineQueue.processQueue();

    expect(result.action.status).toBe('failed');
    expect(result.action.errorCode).toBe('backend_error');
    expect(result.action.retryCount).toBe(1);
  });

  test('does not retry a failed record in the same cycle', async () => {
    mockExecuteAction.mockRejectedValue(new Error('down'));
    offlineQueue.enqueue('tool_call', 'Create a ticket', 'chat-1', 'create_ticket');

    await offlineQueue.processQueue();

    expect(mockExecuteAction).toHaveBeenCalledTimes(1);
  });

  test('retries only after an explicit retry request', async () => {
    mockExecuteAction
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce({message: 'Ticket created'});
    const queued = offlineQueue.enqueue('tool_call', 'Create a ticket', 'chat-1', 'create_ticket');

    await offlineQueue.processQueue();
    expect(offlineQueue.retry(queued.id).status).toBe('pending');
    const [result] = await offlineQueue.processQueue();

    expect(result.action.status).toBe('completed');
    expect(result.response).toBe('Ticket created');
    expect(mockExecuteAction).toHaveBeenLastCalledWith(
      'create_ticket',
      {query: 'Create a ticket'},
      {idempotencyKey: queued.id},
    );
  });

  test('notifies subscribers after queue changes', () => {
    const listener = jest.fn();
    const unsubscribe = offlineQueue.subscribe(listener);

    const queued = offlineQueue.enqueue('tool_call', 'Create a ticket', 'chat-1', 'create_ticket');
    offlineQueue.remove(queued.id);
    unsubscribe();

    expect(listener).toHaveBeenCalledTimes(2);
  });
});
