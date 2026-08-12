jest.mock('../../src/services/offlineQueue', () => ({
  offlineQueue: {
    getQueue: () => [],
    subscribe: () => () => {},
    retry: jest.fn(),
    remove: jest.fn(),
    processQueue: jest.fn(),
  },
}));

import {getOutboxView} from '../../src/screens/OutboxScreen';

test('keeps failed and pending actions visible', () => {
  const view = getOutboxView([
    {
      id: 'done',
      type: 'tool_call',
      query: 'Done',
      createdAt: 1,
      completedAt: 2,
      status: 'completed',
      retryCount: 0,
      chatMessageId: 'chat-1',
    },
    {
      id: 'failed',
      type: 'tool_call',
      query: 'Failed',
      createdAt: 3,
      status: 'failed',
      retryCount: 1,
      chatMessageId: 'chat-2',
    },
  ]);

  expect(view.title).toBe('Outbox');
  expect(view.records.map(record => record.id)).toEqual(['failed', 'done']);
});
