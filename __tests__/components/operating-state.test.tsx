import {getOperatingStateView} from '../../src/components/common/OperatingState';

test('reports demo as a local no-network mode', () => {
  expect(getOperatingStateView({mode: 'demo', isOnline: false})).toEqual({
    label: 'Demo',
    detail: 'Built-in sample answers. No network or model download.',
    tone: 'neutral',
  });
});

test('names the ready system provider without implying cloud use', () => {
  expect(
    getOperatingStateView({
      mode: 'prefer-offline',
      isOnline: false,
      systemProviderName: 'Apple on-device model',
    }),
  ).toEqual({
    label: 'On device',
    detail: 'Apple on-device model is ready. Answers stay on this device.',
    tone: 'ready',
  });
});
