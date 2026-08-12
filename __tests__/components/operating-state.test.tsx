import {getOperatingStateView} from '../../src/components/common/OperatingState';

test('reports demo as a local no-network mode', () => {
  expect(getOperatingStateView({mode: 'demo', isOnline: false})).toEqual({
    label: 'Demo',
    detail: 'Built-in sample answers. No network or model download.',
    tone: 'neutral',
  });
});
