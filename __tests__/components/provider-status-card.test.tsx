import React from 'react';
import {act, create} from 'react-test-renderer';
import {
  getProviderStatusView,
  ProviderStatusCard,
} from '../../src/components/settings/ProviderStatusCard';
import type {InferenceCapabilities} from '../../src/services/inference/types';

const capability = (overrides: Partial<InferenceCapabilities>): InferenceCapabilities => ({
  providerId: 'apple-foundation-models',
  state: 'available',
  locality: 'local',
  supportsStreaming: true,
  supportsCancellation: true,
  ...overrides,
});

test('explains the operator policy reason and model identity', () => {
  expect(
    getProviderStatusView(
      capability({
        state: 'disabled',
        reason: 'provider_disabled',
        modelIdentity: 'apple-system-model/iOS-26.4',
      }),
    ),
  ).toEqual({
    name: 'Apple on-device model',
    status: 'Off by policy',
    detail: 'This provider is disabled by the operator configuration.',
    tone: 'muted',
    modelIdentity: 'apple-system-model/iOS-26.4',
  });
});

test('renders refresh and download as named 44-point actions', () => {
  let tree: ReturnType<typeof create>;
  act(() => {
    tree = create(
      <ProviderStatusCard
        providers={[
          capability({
            providerId: 'android-aicore',
            state: 'downloadable',
            reason: 'download_required',
            osVersion: '36',
          }),
        ]}
        onRefresh={jest.fn()}
        onDownloadSystemAi={jest.fn()}
      />,
    );
  });

  const root = tree!.root;
  expect(root.findByProps({accessibilityLabel: 'Refresh provider status'}).props.style).toEqual(
    expect.objectContaining({minHeight: 44}),
  );
  expect(root.findByProps({accessibilityLabel: 'Download Android system AI'}).props.style).toEqual(
    expect.objectContaining({minHeight: 44}),
  );
});
