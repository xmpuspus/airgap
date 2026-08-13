jest.mock('react-native-fs', () => require('./helpers/rn-mocks').rnFs());
jest.mock('react-native-mmkv', () => require('./helpers/rn-mocks').rnMmkv());
jest.mock('../src/services/connectivityService', () =>
  require('./helpers/rn-mocks').connectivity(),
);
jest.mock('../src/services/secureStorage', () => require('./helpers/rn-mocks').secureStorage());
jest.mock('uuid', () => ({v4: () => 'test-id'}));
jest.mock('llama.rn', () => ({initLlama: jest.fn()}));
jest.mock('react-native', () => ({
  NativeModules: {
    AppleFoundationModelsModule: {harnessScenario: 'available'},
  },
  NativeEventEmitter: jest.fn(),
  Platform: {OS: 'ios'},
}));

import {NativeModules} from 'react-native';
import {
  activeProviderHarnessScenario,
  providerHarnessActive,
} from '../src/services/inference/providerHarness';
import {getConfigMode, getMode} from '../src/services/llmRouter';

describe('provider harness activation', () => {
  const originalDevelopment = __DEV__;

  afterEach(() => {
    (globalThis as {__DEV__?: boolean}).__DEV__ = originalDevelopment;
    (NativeModules as Record<string, unknown>).AppleFoundationModelsModule = {
      harnessScenario: 'available',
    };
    delete (NativeModules as Record<string, unknown>).AndroidAicoreModule;
  });

  test('activates a trimmed native scenario only in development', () => {
    (globalThis as {__DEV__?: boolean}).__DEV__ = true;
    (NativeModules as Record<string, unknown>).AppleFoundationModelsModule = {
      harnessScenario: ' available ',
    };

    expect(activeProviderHarnessScenario()).toBe('available');
    expect(providerHarnessActive()).toBe(true);
  });

  test('uses Android scenario constants when Apple has none', () => {
    (globalThis as {__DEV__?: boolean}).__DEV__ = true;
    (NativeModules as Record<string, unknown>).AppleFoundationModelsModule = {};
    (NativeModules as Record<string, unknown>).AndroidAicoreModule = {
      harnessScenario: 'busy',
    };

    expect(activeProviderHarnessScenario()).toBe('busy');
  });

  test('changes checked demo config to prefer-offline during a harness run', () => {
    (globalThis as {__DEV__?: boolean}).__DEV__ = true;

    expect(getConfigMode()).toBe('prefer-offline');
    expect(getMode()).toBe('prefer-offline');
  });

  test('does not activate native constants in production', () => {
    (globalThis as {__DEV__?: boolean}).__DEV__ = false;

    expect(activeProviderHarnessScenario()).toBeUndefined();
    expect(providerHarnessActive()).toBe(false);
    expect(getConfigMode()).toBe('demo');
  });
});
