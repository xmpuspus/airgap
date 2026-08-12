import {getActionReceiptView} from '../../src/components/chat/ActionReceipt';

test('shows a failed action with retry and remove controls', () => {
  expect(
    getActionReceiptView({
      id: 'queue-1',
      type: 'tool_call',
      toolName: 'create_ticket',
      query: 'Create a ticket',
      createdAt: 1,
      status: 'failed',
      retryCount: 1,
      errorCode: 'backend_error',
      chatMessageId: 'chat-1',
    }),
  ).toEqual({
    title: 'create ticket',
    statusLabel: 'Failed',
    detail: 'The service did not accept this action.',
    actions: ['Retry', 'Remove'],
  });
});
