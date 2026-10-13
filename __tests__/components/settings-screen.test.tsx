import React from 'react';
import {Alert, Text} from 'react-native';
import {act, create} from 'react-test-renderer';

// Animation timers must not fire after the test environment is torn down.
jest.useFakeTimers();
const mockGetMode = jest.fn();
const mockSyncConfigured = jest.fn(() => false);
jest.mock('../../src/services/modelManager', () => ({
  modelManager: {
    isModelDownloaded: jest.fn(async () => false),
    getModelSizeMB: jest.fn(async () => 0),
    deleteModel: jest.fn(),
  },
}));
jest.mock('../../src/services/syncService', () => ({
  getKbSource: () => ({source: 'compiled', bundleVersion: null}),
  getStalenessInfo: () => ({band: 'never', lastSyncAt: null, lastError: null, ageMs: null}),
  isSyncConfigured: () => mockSyncConfigured(),
  onSync: () => () => undefined,
  syncKnowledge: jest.fn(),
}));
jest.mock('../../src/components/settings/DiagnosticsPanel', () => ({DiagnosticsPanel: () => null}));
jest.mock('../../src/services/orchestrator', () => ({
  clearConversationHistory: jest.fn(),
  getConversationHistory: jest.fn(() => []),
}));
jest.mock('react-native-mmkv', () => require('../helpers/rn-mocks').rnMmkv());
jest.mock('../../src/services/secureStorage', () => require('../helpers/rn-mocks').secureStorage());
jest.mock('../../src/services/llmRouter', () => ({
  setUserMode: jest.fn(),
  getMode: () => mockGetMode(),
  getConfigMode: () => mockGetMode(),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0}),
}));
jest.mock('../../src/hooks/useInferenceProviders', () => ({
  useInferenceProviders: () => ({
    providers: [],
    loading: false,
    error: undefined,
    refresh: jest.fn(),
    downloadSystemAi: jest.fn(),
  }),
}));
const mockDelete = jest.fn();
jest.mock('../../src/services/dataDeletionService', () => ({
  deleteAllUserData: () => mockDelete(),
}));

import {SettingsScreen} from '../../src/screens/SettingsScreen';
import {config} from '../../src/config/loader';
import {logger} from '../../src/services/logger';

function render() {
  let tree: ReturnType<typeof create>;
  const navigation = {goBack: jest.fn(), reset: jest.fn()};
  act(() => {
    tree = create(<SettingsScreen {...({navigation} as any)} />);
  });
  return tree!;
}

function textOf(tree: ReturnType<typeof create>): string {
  return tree.root
    .findAllByType(Text)
    .map(node => React.Children.toArray(node.props.children).join(''))
    .join('\n');
}

test('hides the model rows in demo mode', () => {
  mockGetMode.mockReturnValue('demo');
  const text = textOf(render());
  expect(text).not.toContain('Not downloaded');
  expect(text).not.toContain('Download Model');
  expect(text).not.toContain('Delete Model');
});

test('explains demo answers without naming a config file', () => {
  mockGetMode.mockReturnValue('demo');
  const text = textOf(render());
  expect(text).not.toContain('airgap.config.json');
  expect(text).toContain('Your organization sets how answers are made in demo mode.');
});

test('shows the model rows outside demo mode', () => {
  mockGetMode.mockReturnValue('prefer-offline');
  const text = textOf(render());
  expect(text).toContain('Not downloaded');
  expect(text).toContain('Download Model');
});

test('offers Sync now only when an update server is set up', () => {
  mockGetMode.mockReturnValue('demo');
  mockSyncConfigured.mockReturnValue(false);
  expect(textOf(render())).not.toContain('Sync now');
  mockSyncConfigured.mockReturnValue(true);
  expect(textOf(render())).toContain('Sync now');
});

test('calls the records built-in, not unsynced, when no update server is set up', () => {
  mockGetMode.mockReturnValue('demo');
  mockSyncConfigured.mockReturnValue(false);
  const text = textOf(render());
  expect(text).toContain('Built-in records');
  expect(text).not.toContain('Not synced');
  mockSyncConfigured.mockReturnValue(true);
  expect(textOf(render())).toContain('Not synced');
});

describe('about text', () => {
  const original = config.llm;
  afterEach(() => {
    config.llm = original;
  });

  test('says conversations stay on the phone when cloud answers are off', () => {
    mockGetMode.mockReturnValue('demo');
    config.llm = {...original, cloud: {enabled: false}};
    expect(textOf(render())).toContain('Your conversations stay on your phone.');
  });

  test('says questions can reach the online service when cloud answers are on', () => {
    mockGetMode.mockReturnValue('prefer-offline');
    config.llm = {...original, cloud: {enabled: true}};
    const text = textOf(render());
    expect(text).not.toContain('never leave your phone');
    expect(text).toContain('can be sent to an online service');
  });
});

test('delete failure alert hides internal store ids and logs them', async () => {
  mockGetMode.mockReturnValue('demo');
  mockDelete.mockResolvedValue([
    {id: 'conversation', ok: true},
    {id: 'kb-sync', ok: false, error: 'boom'},
  ]);
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  const tree = render();
  act(() => {
    tree.root.findByProps({accessibilityLabel: 'Delete all my data'}).props.onPress();
  });
  const buttons = alert.mock.calls[0][2]!;
  await act(async () => {
    await buttons[1].onPress!();
  });
  expect(alert.mock.calls[1][1]).toBe('Some data could not be deleted. Try again.');
  expect(JSON.stringify(warn.mock.calls)).toContain('kb-sync');
  alert.mockRestore();
  warn.mockRestore();
});
