import React from 'react';
import {View} from 'react-native';
import {act, create} from 'react-test-renderer';
import {
  getProviderSetupView,
  ProviderSetupCard,
} from '../../src/components/onboarding/ProviderSetupCard';
import type {InferenceCapabilities} from '../../src/services/inference/types';

const capability = (overrides: Partial<InferenceCapabilities>): InferenceCapabilities => ({
  providerId: 'apple-foundation-models',
  state: 'available',
  locality: 'local',
  supportsStreaming: true,
  supportsCancellation: true,
  ...overrides,
});

test.each([
  [
    capability({providerId: 'apple-foundation-models', state: 'available'}),
    {title: 'System AI ready', action: 'Continue'},
  ],
  [
    capability({
      providerId: 'android-aicore',
      state: 'downloadable',
      reason: 'download_required',
    }),
    {title: 'System AI needs setup', action: 'Download system AI'},
  ],
  [
    capability({
      providerId: 'android-aicore',
      state: 'downloading',
      reason: 'download_required',
    }),
    {title: 'System AI is downloading', action: undefined},
  ],
  [
    capability({state: 'unavailable', reason: 'unsupported_device'}),
    {title: 'System AI is not available', action: 'Use another option'},
  ],
] as const)('maps setup state %# to plain next-step copy', (input, expected) => {
  expect(getProviderSetupView(input)).toMatchObject(expected);
});

test('renders an ordered provider rail and an accessible download control', () => {
  const download = jest.fn();
  let tree: ReturnType<typeof create>;
  act(() => {
    tree = create(
      <ProviderSetupCard
        providers={[
          capability({
            providerId: 'android-aicore',
            state: 'downloadable',
            reason: 'download_required',
          }),
          capability({providerId: 'llama-rn', state: 'unavailable', reason: 'model_not_ready'}),
          capability({providerId: 'demo', state: 'available'}),
        ]}
        onDownloadSystemAi={download}
        onContinue={jest.fn()}
      />,
    );
  });

  const root = tree!.root;
  expect(root.findByProps({accessibilityLabel: 'Download system AI'}).props.accessibilityHint).toBe(
    'Downloads the device system model, then checks readiness again',
  );
  expect(
    root
      .findAllByType(View)
      .filter(
        node =>
          node.props.accessibilityRole === 'text' &&
          typeof node.props.accessibilityLabel === 'string' &&
          /^\d\./.test(node.props.accessibilityLabel),
      ),
  ).toHaveLength(3);
  expect(JSON.stringify(tree!.toJSON())).not.toContain('AICore');
});

test('reports download progress to assistive technology', () => {
  let tree: ReturnType<typeof create>;
  act(() => {
    tree = create(
      <ProviderSetupCard
        providers={[
          capability({
            providerId: 'android-aicore',
            state: 'downloading',
            reason: 'download_required',
          }),
        ]}
        downloadProgress={0.42}
        onContinue={jest.fn()}
      />,
    );
  });

  expect(
    tree!.root.findByProps({accessibilityRole: 'progressbar'}).props.accessibilityValue,
  ).toEqual({
    min: 0,
    max: 100,
    now: 42,
  });
});
