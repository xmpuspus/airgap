import {
  chatErrorReply,
  chatKeyboardBehavior,
  formatMegabytes,
  formatModelSize,
  howThisWorksDefaults,
  recordsStatusLabel,
  showsOutbox,
} from '../../src/utils/appChrome';
import {providerReasonDetail} from '../../src/services/inference/providerPresentation';
import {config, interpolate} from '../../src/config/loader';

describe('header', () => {
  test('names built-in records when no update server is set up', () => {
    expect(recordsStatusLabel(false, 'Not synced')).toBe('Built-in records');
    expect(recordsStatusLabel(true, 'Not synced')).toBe('Not synced');
  });

  test('hides Outbox when the template turns the offline queue off', () => {
    expect(showsOutbox({offlineQueue: false})).toBe(false);
    expect(showsOutbox({offlineQueue: true})).toBe(true);
    expect(showsOutbox(undefined)).toBe(true);
  });
});

describe('onboarding', () => {
  test('promises sync only when an update server is set up', () => {
    const local = howThisWorksDefaults(false);
    expect(local.join(' ')).not.toMatch(/sync/i);
    expect(local.join(' ')).not.toMatch(/operator/i);
    expect(howThisWorksDefaults(true).join(' ')).toMatch(/update/i);
  });

  test('gives the model size in the same unit everywhere', () => {
    expect(formatModelSize(2445652064)).toBe('2.4 GB');
    expect(formatMegabytes(2445)).toBe('2.4 GB');
    expect(formatMegabytes(600)).toBe('600 MB');
    expect(formatModelSize(undefined)).toBe('size not set');
  });

  test('uses the same unit in the download prompt', () => {
    const sized = (sizeMB: number) => ({...config, model: {...config.model, sizeMB}});
    expect(interpolate('{{modelSize}}', sized(2445))).toBe('~2.4 GB');
    expect(interpolate('{{modelSize}}', sized(1020))).toBe('~1.0 GB');
    expect(interpolate('{{modelSize}}', sized(600))).toBe('~600 MB');
  });
});

describe('chat error reply', () => {
  test('gives the configured hotline, not a fixed number', () => {
    expect(chatErrorReply('8888')).toBe('Sorry, something went wrong. Try again, or call 8888.');
    expect(chatErrorReply(undefined)).toBe('Sorry, something went wrong. Try again.');
  });
});

describe('chat input', () => {
  test('moves the input above the keyboard on Android as well as iOS', () => {
    expect(chatKeyboardBehavior('android')).toBe('padding');
    expect(chatKeyboardBehavior('ios')).toBe('padding');
  });
});

describe('demo provider', () => {
  test('says that demo answers show the records as written', () => {
    expect(
      providerReasonDetail({
        providerId: 'demo',
        state: 'available',
        locality: 'local',
        supportsStreaming: false,
        supportsCancellation: false,
      }),
    ).toBe('Answers show the stored records as written.');
  });
});
