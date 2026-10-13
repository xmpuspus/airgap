import React from 'react';
import {Text} from 'react-native';
import {act, create} from 'react-test-renderer';

jest.mock('@react-navigation/native', () => ({NavigationContainer: () => null}));
jest.mock('@react-navigation/native-stack', () => ({createNativeStackNavigator: () => ({})}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({children}: any) => children,
}));
jest.mock('../../src/services/connectivityService', () => ({
  connectivityService: {destroy: jest.fn()},
}));
jest.mock('../../src/services/syncService', () => ({
  startSyncScheduler: jest.fn(),
  stopSyncScheduler: jest.fn(),
  loadBundleIntoKnowledge: jest.fn(async () => undefined),
}));
jest.mock('../../src/services/modelManager', () => ({modelManager: {checkForUpdate: jest.fn()}}));
jest.mock('../../src/services/telemetry', () => ({startTelemetryFlusher: jest.fn()}));
jest.mock('../../src/services/secureStorage', () => ({
  initializeSecureStorage: jest.fn(async () => {
    throw new Error('locked');
  }),
  getSecureStore: jest.fn(),
}));
jest.mock('../../src/screens/ChatScreen', () => () => null);
jest.mock('../../src/screens/OnboardingScreen', () => () => null);
jest.mock('../../src/screens/SettingsScreen', () => () => null);
jest.mock('../../src/screens/OutboxScreen', () => () => null);
jest.mock('../../src/components/common/StalenessChip', () => ({StalenessChip: () => null}));

import App from '../../src/App';
import {brand} from '../../src/config/loader';

test('names the configured app in the startup error', async () => {
  const original = brand.name;
  brand.name = 'Test Agency';
  let tree: ReturnType<typeof create>;
  await act(async () => {
    tree = create(<App />);
  });
  const text = tree!.root
    .findAllByType(Text)
    .map(node => React.Children.toArray(node.props.children).join(''))
    .join('\n');
  expect(text).toContain('Test Agency could not start');
  expect(text).toContain('restart Test Agency.');
  expect(text).not.toContain('Airgap');
  brand.name = original;
});
