import React from 'react';
import {Text} from 'react-native';
import {act, create} from 'react-test-renderer';

// Animation timers must not fire after the test environment is torn down.
jest.useFakeTimers();
jest.mock('react-native-mmkv', () => require('../helpers/rn-mocks').rnMmkv());
jest.mock('../../src/services/secureStorage', () => require('../helpers/rn-mocks').secureStorage());
jest.mock('../../src/services/offlineQueue', () => ({
  offlineQueue: {getQueue: () => [], subscribe: () => () => undefined},
}));
jest.mock('../../src/services/syncService', () => ({
  getStalenessInfo: () => ({band: 'never', lastSyncAt: null, lastError: null, ageMs: null}),
}));
jest.mock('../../src/services/searchService', () => ({
  getDocById: (id: string) => ({id, category: 'faq', title: `Record ${id}`, metadata: {}}),
}));

import {CitationChips} from '../../src/components/chat/CitationChips';
import {EmptyState} from '../../src/components/chat/EmptyState';
import {MessageBubble} from '../../src/components/chat/MessageBubble';
import {getActionReceiptView} from '../../src/components/chat/ActionReceipt';
import {toolDisplayName} from '../../src/components/chat/toolDisplayName';
import {ErrorBoundary} from '../../src/components/common/ErrorBoundary';
import {logger} from '../../src/services/logger';

function render(element: React.ReactElement) {
  let tree: ReturnType<typeof create>;
  act(() => {
    tree = create(element);
  });
  return tree!;
}

function textOf(tree: ReturnType<typeof create>): string {
  return tree.root
    .findAllByType(Text)
    .map(node => React.Children.toArray(node.props.children).join(''))
    .join('\n');
}

test('shows no hard-coded feature pills in the empty state', () => {
  const text = textOf(render(<EmptyState onQuickReply={jest.fn()} />));
  expect(text).not.toContain('Plans & Pricing');
  expect(text).not.toContain('Troubleshooting');
  expect(text).not.toContain('Store Locator');
});

test('the overflow chip hint says it opens the next source', () => {
  const tree = render(<CitationChips docIds={['a', 'b', 'c', 'd']} />);
  const chip = tree.root.findByProps({accessibilityLabel: '1 more sources'});
  expect(chip.props.accessibilityHint).toBe('Opens the next source');
});

describe('toolDisplayName', () => {
  test('turns a tool id into plain words', () => {
    expect(toolDisplayName('create_ticket')).toBe('create ticket');
    expect(toolDisplayName('check_balance_now')).toBe('check balance now');
  });
});

describe('action receipt', () => {
  test('falls back to an unknown status instead of throwing', () => {
    const view = getActionReceiptView({
      id: 'queue-2',
      type: 'tool_call',
      toolName: 'create_ticket',
      query: 'Create a ticket',
      createdAt: 1,
      status: 'archived',
      retryCount: 0,
      chatMessageId: 'chat-1',
    } as any);
    expect(view.statusLabel).toBe('Unknown');
    expect(view.actions).toEqual([]);
  });
});

test('the message bubble shows the tool name in plain words', () => {
  const tree = render(
    <MessageBubble
      message={{
        _id: 'm1',
        text: 'Ticket created.',
        createdAt: new Date(),
        user: {_id: 'bot', name: 'Bot'},
        source: 'tool',
        audit: {toolName: 'create_ticket'},
      }}
    />,
  );
  const text = textOf(tree);
  expect(text).toContain('create ticket');
  expect(text).not.toContain('create_ticket');
});

test('the error boundary button label matches its visible text', () => {
  const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  const logged = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
  function Boom(): React.ReactElement {
    throw new Error('render failed');
  }
  const tree = render(
    <ErrorBoundary>
      <Boom />
    </ErrorBoundary>,
  );
  expect(textOf(tree)).toContain('Try Again');
  expect(tree.root.findByProps({accessibilityRole: 'button'}).props.accessibilityLabel).toBe(
    'Try Again',
  );
  error.mockRestore();
  logged.mockRestore();
});
