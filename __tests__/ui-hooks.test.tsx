import React from 'react';
import {act, create} from 'react-test-renderer';

const mockGetMode = jest.fn();
const mockReadCapabilities = jest.fn();
jest.mock('../src/services/modelManager', () => ({
  modelManager: {
    isModelDownloaded: jest.fn(async () => true),
    getModelSizeMB: jest.fn(async () => 1),
  },
}));
jest.mock('../src/services/llmRouter', () => ({
  getMode: () => mockGetMode(),
  getInferenceProviders: () => [],
}));
jest.mock('../src/services/inference/providerReadiness', () => ({
  readConfiguredProviderCapabilities: (...args: unknown[]) => mockReadCapabilities(...args),
  selectProviderEntriesForMode: () => [],
}));

import {useModelDownload} from '../src/hooks/useModelDownload';
import {useInferenceProviders} from '../src/hooks/useInferenceProviders';
import {logger} from '../src/services/logger';

function renderHook<T>(useHook: () => T) {
  const result = {} as {current: T};
  function Probe() {
    result.current = useHook();
    return null;
  }
  act(() => {
    create(<Probe />);
  });
  return result;
}

describe('useModelDownload', () => {
  test('reports no downloaded model in demo mode', async () => {
    mockGetMode.mockReturnValue('demo');
    const hook = renderHook(useModelDownload);
    await act(async () => undefined);
    expect(hook.current.isDownloaded).toBe(false);
  });

  test('reads the stored model outside demo mode', async () => {
    mockGetMode.mockReturnValue('prefer-offline');
    const hook = renderHook(useModelDownload);
    await act(async () => undefined);
    expect(hook.current.isDownloaded).toBe(true);
  });
});

describe('useInferenceProviders', () => {
  test('stops loading and logs when a refresh throws', async () => {
    mockGetMode.mockReturnValue('prefer-offline');
    mockReadCapabilities.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('bridge down'));
    const error = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
    const hook = renderHook(useInferenceProviders);
    await act(async () => undefined);
    expect(hook.current.loading).toBe(false);

    await act(async () => {
      await expect(hook.current.refresh()).resolves.toBeUndefined();
    });

    expect(hook.current.loading).toBe(false);
    expect(hook.current.error).toBe('Provider status could not be refreshed.');
    expect(error).toHaveBeenCalledWith(
      'useInferenceProviders',
      expect.any(String),
      expect.anything(),
    );
    error.mockRestore();
  });
});
