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
    title: 'Create ticket',
    statusLabel: 'Failed',
    detail: 'The service did not accept this action.',
    actions: ['Retry', 'Remove'],
  });
});

test('titles a configured tool with its label', () => {
  expect(
    getActionReceiptView({
      id: 'queue-2',
      type: 'tool_call',
      toolName: 'createTicket',
      query: 'Create a ticket',
      createdAt: 1,
      status: 'pending',
      retryCount: 0,
      chatMessageId: 'chat-2',
    }).title,
  ).toBe('Open a support ticket');
});

test('titles a configured action with its label', () => {
  expect(
    getActionReceiptView({
      id: 'queue-3',
      type: 'balance_check',
      query: 'What is my balance',
      createdAt: 1,
      status: 'pending',
      retryCount: 0,
      chatMessageId: 'chat-3',
    }).title,
  ).toBe('Check account balance');
});

test('turns an unknown camelCase id into words', () => {
  expect(
    getActionReceiptView({
      id: 'queue-4',
      type: 'tool_call',
      toolName: 'lookupParcelStatus',
      query: 'Where is my parcel',
      createdAt: 1,
      status: 'pending',
      retryCount: 0,
      chatMessageId: 'chat-4',
    }).title,
  ).toBe('Lookup parcel status');
});
