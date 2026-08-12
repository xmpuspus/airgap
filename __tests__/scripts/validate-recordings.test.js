const path = require('node:path');
const {Buffer} = require('node:buffer');
const fs = require('node:fs');

const {
  REQUIRED_OUTPUTS,
  maestroRecordingPath,
  sizeLimitFor,
  validateManifest,
  validateRecording,
} = require('../../scripts/lib/recordings.js');

const SHA = '1234567890abcdef1234567890abcdef12345678';

function record(overrides = {}) {
  return {
    id: 'android',
    kind: 'platform',
    output: 'demo/airgap-demo.gif',
    source: `tmp/recordings/${SHA}/android.mp4`,
    contactSheet: `tmp/recordings/${SHA}/android-contact.png`,
    script: 'scripts/record-demo.mjs',
    sourceCommit: SHA,
    platform: 'android',
    os: 'Android 16 API 36',
    device: 'airgap_test',
    mode: 'demo',
    config: 'airgap.config.json',
    capturedAt: '2026-08-12T12:00:00.000Z',
    width: 360,
    height: 800,
    fps: 10,
    durationSeconds: 24,
    bytes: 1024,
    loopReviewed: true,
    ...overrides,
  };
}

describe('recording manifest validation', () => {
  test('gives Maestro an absolute recording path', () => {
    const output = maestroRecordingPath('tmp/recordings/commit/android');

    expect(path.isAbsolute(output)).toBe(true);
    expect(output).toMatch(/\/tmp\/recordings\/commit\/android$/);
  });

  test.each(['demo-android.yaml', 'demo-ios.yaml', 'industry-android.yaml'])(
    '%s selects the offline demo button instead of its duplicate heading',
    flowName => {
      const flow = fs.readFileSync(
        path.join(process.cwd(), 'scripts/recording-flows', flowName),
        'utf8',
      );

      expect(flow).toMatch(/element:\n\s+text: 'Try Offline Demo'\n\s+index: 1/);
      expect(flow).toMatch(/tapOn:\n\s+text: 'Try Offline Demo'\n\s+index: 1/);
    },
  );

  test('dismisses the Android keyboard before tapping the send button', () => {
    const flow = fs.readFileSync(
      path.join(process.cwd(), 'scripts/recording-flows/demo-android.yaml'),
      'utf8',
    );

    expect(flow).toMatch(/inputText: 'Create a ticket'\n- hideKeyboard\n- tapOn: 'Send message'/);
    expect(flow).not.toContain("inputText: 'Check my balance'");
  });

  test.each(['demo-android.yaml', 'demo-ios.yaml', 'industry-android.yaml'])(
    '%s waits for the current provenance label',
    flowName => {
      const flow = fs.readFileSync(
        path.join(process.cwd(), 'scripts/recording-flows', flowName),
        'utf8',
      );

      expect(flow).toContain("visible: 'On-device model'");
      expect(flow).not.toContain("visible: 'Local knowledge'");
    },
  );

  test('rejects an asset that exceeds its limit', () => {
    expect(() =>
      validateRecording(record(), {
        actualBytes: sizeLimitFor('platform') + 1,
        header: Buffer.from('GIF89a'),
        probe: {width: 360, height: 800, fps: 10, durationSeconds: 24},
      }),
    ).toThrow('recording_size_limit');
  });

  test('needs a checked commit for every GIF', () => {
    expect(() =>
      validateManifest({schemaVersion: 1, recordings: [record({sourceCommit: ''})]}),
    ).toThrow('recording_commit_missing');
  });

  test('requires every release recording path', () => {
    expect(() => validateManifest({schemaVersion: 1, recordings: [record()]})).toThrow(
      'recording_output_missing',
    );
    expect(REQUIRED_OUTPUTS).toHaveLength(10);
  });

  test('requires source evidence under the commit recording directory', () => {
    expect(() => validateRecording(record({source: path.join('tmp', 'wrong.mp4')}))).toThrow(
      'recording_source_path_invalid',
    );
  });

  test('accepts measured GIF facts that match the manifest', () => {
    expect(() =>
      validateRecording(record(), {
        actualBytes: 1024,
        header: Buffer.from('GIF89a'),
        probe: {width: 360, height: 800, fps: 10, durationSeconds: 24},
      }),
    ).not.toThrow();
  });
});
