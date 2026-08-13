jest.mock('react-native', () => ({
  NativeModules: {},
  NativeEventEmitter: jest.fn(),
}));

import {createAndroidAicoreProvider} from '../src/services/inference/androidAicoreProvider';

type NativeEvent = {
  requestId: string;
  token?: string;
  bytesDownloaded?: number;
  totalBytes?: number;
};

function eventSource() {
  const listeners = new Map<string, (event: NativeEvent) => void>();
  return {
    source: {
      addListener: jest.fn((name: string, listener: (event: NativeEvent) => void) => {
        listeners.set(name, listener);
        return {remove: jest.fn(() => listeners.delete(name))};
      }),
    },
    emit(name: string, event: NativeEvent) {
      listeners.get(name)?.(event);
    },
  };
}

function nativeBridge(overrides: Record<string, unknown> = {}) {
  return {
    getCapabilities: jest.fn(async () => ({
      state: 'AVAILABLE' as const,
      modelIdentity: 'google-gemini-nano/aicore',
      osVersion: '36',
    })),
    download: jest.fn(async () => true),
    warmup: jest.fn(async () => true),
    generate: jest.fn(async () => ({
      text: 'Local answer',
      modelIdentity: 'google-gemini-nano/aicore',
    })),
    cancel: jest.fn(async () => true),
    ...overrides,
  };
}

describe('Android AICore provider', () => {
  test.each([
    ['UNAVAILABLE', 'unavailable', 'unsupported_device'],
    ['UNSUPPORTED_OS', 'unavailable', 'unsupported_os'],
    ['DOWNLOADABLE', 'downloadable', 'download_required'],
    ['DOWNLOADING', 'downloading', 'download_required'],
    ['AVAILABLE', 'available', undefined],
  ] as const)('maps %s feature status', async (nativeState, state, reason) => {
    const native = nativeBridge({
      getCapabilities: jest.fn(async () => ({state: nativeState})),
    });
    const provider = createAndroidAicoreProvider(native, eventSource().source);

    await expect(provider.getCapabilities()).resolves.toMatchObject({state, reason});
    expect(native.generate).not.toHaveBeenCalled();
  });

  test('streams only tokens for the active request and records identity', async () => {
    const events = eventSource();
    const native = nativeBridge({
      generate: jest.fn(async ({requestId}: {requestId: string}) => {
        events.emit('AirgapInferenceToken', {requestId: 'another-request', token: 'ignore'});
        events.emit('AirgapInferenceToken', {requestId, token: 'Local '});
        events.emit('AirgapInferenceToken', {requestId, token: 'answer'});
        return {text: 'Local answer', modelIdentity: 'google-gemini-nano/aicore'};
      }),
    });
    const provider = createAndroidAicoreProvider(native, events.source);
    const tokens: string[] = [];

    const result = await provider.generate({
      requestId: 'android-1',
      systemPrompt: 'Use the documents.',
      userMessage: 'Question and documents',
      onToken: token => tokens.push(token),
    });

    expect(tokens).toEqual(['Local ', 'answer']);
    expect(result).toMatchObject({
      text: 'Local answer',
      providerId: 'android-aicore',
      modelIdentity: 'google-gemini-nano/aicore',
      locality: 'local',
    });
    expect(provider.getLastRunStats()).toMatchObject({
      providerId: 'android-aicore',
      tokenCount: 2,
    });
  });

  test('reports download progress for the matching request', async () => {
    const events = eventSource();
    const native = nativeBridge({
      download: jest.fn(async (requestId: string) => {
        events.emit('AirgapInferenceDownload', {
          requestId: 'another-request',
          bytesDownloaded: 1,
          totalBytes: 100,
        });
        events.emit('AirgapInferenceDownload', {
          requestId,
          bytesDownloaded: 25,
          totalBytes: 100,
        });
        return true;
      }),
    });
    const provider = createAndroidAicoreProvider(native, events.source);
    const updates: Array<{bytesDownloaded: number; totalBytes?: number}> = [];

    await provider.download('download-1', progress => updates.push(progress));

    expect(updates).toEqual([{bytesDownloaded: 25, totalBytes: 100}]);
    expect(native.download).toHaveBeenCalledWith('download-1');
  });

  test.each([
    ['quota_exceeded', 'quota_exceeded'],
    ['background_blocked', 'background_blocked'],
    ['context_exceeded', 'context_exceeded'],
    ['model_not_ready', 'model_not_ready'],
    ['cancelled', 'cancelled'],
    ['generation_failed', 'generation_failed'],
  ] as const)('normalizes native error %s', async (nativeCode, reason) => {
    const native = nativeBridge({
      generate: jest.fn(async () => {
        throw Object.assign(new Error(nativeCode), {code: nativeCode});
      }),
    });
    const provider = createAndroidAicoreProvider(native, eventSource().source);

    await expect(
      provider.generate({
        requestId: 'android-2',
        systemPrompt: 'system',
        userMessage: 'grounded prompt',
      }),
    ).rejects.toMatchObject({reason});
  });

  test('warms the model and cancels the matching request', async () => {
    const native = nativeBridge();
    const provider = createAndroidAicoreProvider(native, eventSource().source);

    await provider.warmup();
    await provider.cancel('android-3');

    expect(native.warmup).toHaveBeenCalledTimes(1);
    expect(native.cancel).toHaveBeenCalledWith('android-3');
  });
});
