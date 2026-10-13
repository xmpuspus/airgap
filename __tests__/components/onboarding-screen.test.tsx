import React from 'react';
import {Text} from 'react-native';
import {act, create} from 'react-test-renderer';

// Animation timers must not fire after the test environment is torn down.
jest.useFakeTimers();
const mockGetMode = jest.fn();
jest.mock('react-native-mmkv', () => require('../helpers/rn-mocks').rnMmkv());
jest.mock('../../src/services/secureStorage', () => require('../helpers/rn-mocks').secureStorage());
jest.mock('../../src/services/llmRouter', () => ({getMode: () => mockGetMode()}));
jest.mock('../../src/services/modelManager', () => ({
  modelManager: {
    isModelDownloaded: jest.fn(async () => true),
    getModelSizeMB: jest.fn(async () => 2445),
  },
}));
jest.mock('../../src/services/syncService', () => ({isSyncConfigured: () => false}));
jest.mock('../../src/services/authProvider', () => ({hasAccessTokenProvider: () => true}));
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

import {OnboardingScreen} from '../../src/screens/OnboardingScreen';
import {config} from '../../src/config/loader';

async function render() {
  let tree: ReturnType<typeof create>;
  const navigation = {replace: jest.fn()};
  await act(async () => {
    tree = create(<OnboardingScreen {...({navigation} as any)} />);
  });
  return tree!.root
    .findAllByType(Text)
    .map(node => React.Children.toArray(node.props.children).join(''))
    .join('\n');
}

describe('model readiness', () => {
  test('shows no model ready message in demo mode', async () => {
    mockGetMode.mockReturnValue('demo');
    const text = await render();
    expect(text).not.toContain('AI model ready');
    expect(text).not.toContain('Start Chatting');
    expect(text).not.toContain('Install Local AI');
  });

  test('shows the model ready message when a model is stored', async () => {
    mockGetMode.mockReturnValue('prefer-offline');
    const text = await render();
    expect(text).toContain('AI model ready');
    expect(text).toContain('Install Local AI');
  });
});

describe('path cards', () => {
  const original = config.llm;
  afterEach(() => {
    config.llm = original;
  });

  test('carry no numbered eyebrow and use plain service copy', async () => {
    mockGetMode.mockReturnValue('prefer-offline');
    config.llm = {...original, cloud: {enabled: true}};
    const text = await render();
    expect(text).not.toMatch(/PATH \d/);
    expect(text).not.toContain('access-token');
    expect(text).toContain("Uses your organization's online service when connected.");
  });
});
