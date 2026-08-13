jest.mock('react-native', () => ({
  NativeModules: {},
  NativeEventEmitter: jest.fn(),
}));

import {createAppleFoundationModelsProvider} from '../src/services/inference/appleFoundationModelsProvider';

function eventSource() {
  let listener: ((event: {requestId: string; token: string}) => void) | undefined;
  return {
    source: {
      addListener: jest.fn((_name: string, next: typeof listener) => {
        listener = next;
        return {remove: jest.fn()};
      }),
    },
    emit(event: {requestId: string; token: string}) {
      listener?.(event);
    },
  };
}

describe('Apple Foundation Models provider', () => {
  test.each([
    ['deviceNotEligible', 'unsupported_device'],
    ['appleIntelligenceNotEnabled', 'provider_disabled'],
    ['modelNotReady', 'model_not_ready'],
    ['unsupportedLocale', 'unsupported_locale'],
    ['unsupportedOs', 'unsupported_os'],
  ] as const)('maps %s without sending a prompt', async (nativeReason, reason) => {
    const native = {
      getCapabilities: jest.fn(async () => ({state: 'unavailable' as const, reason: nativeReason})),
      generate: jest.fn(),
      cancel: jest.fn(async () => true),
    };
    const events = eventSource();
    const provider = createAppleFoundationModelsProvider(native, events.source);

    await expect(provider.getCapabilities()).resolves.toMatchObject({state: 'unavailable', reason});
    expect(native.generate).not.toHaveBeenCalled();
  });

  test('streams only events for the active request and records identity', async () => {
    const events = eventSource();
    const native = {
      getCapabilities: jest.fn(async () => ({
        state: 'available' as const,
        contextSize: 4096,
        modelIdentity: 'apple-system-model/iOS-26.4',
      })),
      generate: jest.fn(async ({requestId}: {requestId: string}) => {
        events.emit({requestId: 'another-request', token: 'ignore'});
        events.emit({requestId, token: 'Local '});
        events.emit({requestId, token: 'answer'});
        return {text: 'Local answer', modelIdentity: 'apple-system-model/iOS-26.4'};
      }),
      cancel: jest.fn(async () => true),
    };
    const provider = createAppleFoundationModelsProvider(native, events.source);
    const tokens: string[] = [];

    const result = await provider.generate({
      requestId: 'apple-1',
      systemPrompt: 'Use the documents.',
      userMessage: 'Question and documents',
      onToken: token => tokens.push(token),
    });

    expect(tokens).toEqual(['Local ', 'answer']);
    expect(result).toMatchObject({
      text: 'Local answer',
      providerId: 'apple-foundation-models',
      modelIdentity: 'apple-system-model/iOS-26.4',
      locality: 'local',
    });
    expect(provider.getLastRunStats()).toMatchObject({
      providerId: 'apple-foundation-models',
      tokenCount: 2,
    });
  });

  test.each([
    ['context_exceeded', 'context_exceeded'],
    ['unsupported_locale', 'unsupported_locale'],
    ['busy', 'busy'],
    ['quota_exceeded', 'quota_exceeded'],
    ['cancelled', 'cancelled'],
    ['generation_failed', 'generation_failed'],
  ] as const)('normalizes native error %s', async (nativeCode, reason) => {
    const native = {
      getCapabilities: jest.fn(),
      generate: jest.fn(async () => {
        throw Object.assign(new Error(nativeCode), {code: nativeCode});
      }),
      cancel: jest.fn(async () => true),
    };
    const provider = createAppleFoundationModelsProvider(native, eventSource().source);

    await expect(
      provider.generate({
        requestId: 'apple-1',
        systemPrompt: 'system',
        userMessage: 'grounded prompt',
      }),
    ).rejects.toMatchObject({reason});
  });

  test('cancels the matching native request', async () => {
    const native = {
      getCapabilities: jest.fn(),
      generate: jest.fn(),
      cancel: jest.fn(async () => true),
    };
    const provider = createAppleFoundationModelsProvider(native, eventSource().source);

    await provider.cancel('apple-3');

    expect(native.cancel).toHaveBeenCalledWith('apple-3');
  });
});
