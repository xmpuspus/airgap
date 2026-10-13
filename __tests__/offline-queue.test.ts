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

  test('sends a configured action without a dedicated method to the backend', async () => {
    mockExecuteAction.mockResolvedValue({message: 'Refill request sent.'});
    const queued = offlineQueue.enqueue('prescription_refill', 'Refill my prescription', 'chat-1');

    const [result] = await offlineQueue.processQueue();

    expect(mockExecuteAction).toHaveBeenCalledWith(
      'prescription_refill',
      {query: 'Refill my prescription'},
      {idempotencyKey: queued.id},
    );
    expect(result.action.status).toBe('completed');
    expect(result.response).toBe('Refill request sent.');
  });

  test('keeps a running record in processing for other readers', async () => {
    let finish: (value: {message: string}) => void = () => undefined;
    mockExecuteAction.mockReturnValue(new Promise(resolve => (finish = resolve)));
    offlineQueue.enqueue('tool_call', 'Create a ticket', 'chat-1', 'create_ticket');

    const run = offlineQueue.processQueue();
    expect(offlineQueue.getQueue()[0].status).toBe('processing');
    finish({message: 'Ticket created'});
    await run;

    expect(offlineQueue.getQueue()[0].status).toBe('completed');
  });

  test('returns a record left in processing to pending when the queue loads', () => {
    jest.isolateModules(() => {
      const {getSecureStore} = require('../src/services/secureStorage');
      getSecureStore('offline-queue').set(
        'queued_actions',
        JSON.stringify([
          {
            id: 'stranded',
            type: 'tool_call',
            toolName: 'create_ticket',
            query: 'Create a ticket',
            createdAt: 1,
            status: 'processing',
            retryCount: 0,
            chatMessageId: 'chat-1',
          },
        ]),
      );
      const {offlineQueue: loaded} = require('../src/services/offlineQueue');

      expect(loaded.getQueue()[0].status).toBe('pending');
    });
  });
});
