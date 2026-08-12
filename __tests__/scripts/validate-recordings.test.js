const path = require('node:path');
const {Buffer} = require('node:buffer');
const fs = require('node:fs');
const os = require('node:os');

const {
  README_GIF_OPTIONS,
  REQUIRED_OUTPUTS,
  gifFilter,
  gifPaletteFilter,
  maestroRecordingPath,
  readmeLayoutFilter,
  sizeLimitFor,
  replaceKnowledgeData,
  selectIndustryQuickReply,
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

  test('builds one FFmpeg preprocessing chain before palette generation', () => {
    expect(gifFilter({fps: 10, width: 360, colors: 96})).toBe(
      'fps=10,scale=360:-2:flags=lanczos,split[s0][s1];' +
        '[s0]palettegen=max_colors=96:stats_mode=diff[p];' +
        '[s1][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle',
    );
  });

  test('builds one FFmpeg palette chain for the combined recording', () => {
    expect(gifPaletteFilter({fps: 10, colors: 80, ditherScale: 5})).toBe(
      'fps=10,split[s0][s1];' +
        '[s0]palettegen=max_colors=80:stats_mode=diff[p];' +
        '[s1][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle',
    );
  });

  test('uses a compact two-panel README layout', () => {
    expect(readmeLayoutFilter({panelWidth: 300, panelHeight: 668, gap: 12})).toBe(
      '[0:v]scale=300:-2:flags=lanczos,pad=300:668:0:(oh-ih)/2:color=0x071727[a];' +
        '[1:v]scale=300:-2:flags=lanczos,pad=300:668:0:(oh-ih)/2:color=0x071727[b];' +
        '[a][b]xstack=inputs=2:layout=0_0|312_0:fill=0x071727[v]',
    );
  });

  test('keeps the README GIF preset within its asset budget', () => {
    expect(README_GIF_OPTIONS).toEqual({
      panelWidth: 280,
      panelHeight: 622,
      gap: 12,
      fps: 10,
      colors: 40,
      ditherScale: 5,
    });
  });

  test('excludes generated release evidence from type checks', () => {
    const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'tsconfig.json'), 'utf8'));

    expect(config.exclude).toContain('tmp');
  });

  test('replaces knowledge JSON without deleting module code', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airgap-recording-'));
    const source = path.join(root, 'source');
    const target = path.join(root, 'target');
    fs.mkdirSync(source);
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(source, 'industry.json'), '[]');
    fs.writeFileSync(path.join(target, 'default.json'), '[]');
    fs.writeFileSync(path.join(target, 'index.ts'), 'export const ready = true;');

    try {
      replaceKnowledgeData(source, target);

      expect(fs.readdirSync(target).sort()).toEqual(['index.ts', 'industry.json']);
      expect(fs.readFileSync(path.join(target, 'index.ts'), 'utf8')).toContain('ready');
    } finally {
      fs.rmSync(root, {recursive: true, force: true});
    }
  });

  test.each([
    ['airline', 'Baggage rules'],
    ['banking', 'Find ATM'],
    ['electric-utility', 'Power restoration'],
    ['healthcare', 'Book appointment'],
    ['insurance', 'File a claim'],
    ['telco', 'Check plans'],
    ['water-utility', 'Conservation tips'],
  ])('selects a local-knowledge reply for %s', (industry, expectedTitle) => {
    const config = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'examples', industry, 'airgap.config.json'), 'utf8'),
    );

    expect(selectIndustryQuickReply(config)).toBe(expectedTitle);
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
    expect(flow).toMatch(/tapOn: 'Send message'\n- extendedWaitUntil:\n\s+visible: 'Queued'/);
  });

  test('uses the native iOS Back control after inspecting Outbox', () => {
    const flow = fs.readFileSync(
      path.join(process.cwd(), 'scripts/recording-flows/demo-ios.yaml'),
      'utf8',
    );

    expect(flow).toContain("- tapOn: 'Back'");
    expect(flow).not.toMatch(/^\s*- back\s*$/m);
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

  test('accepts the wider combined README recording', () => {
    expect(() =>
      validateRecording(
        record({
          id: 'readme',
          kind: 'readme',
          output: 'demo/airgap-readme-side-by-side.gif',
          source: `tmp/recordings/${SHA}/readme-side-by-side.mp4`,
          contactSheet: `tmp/recordings/${SHA}/readme-side-by-side-contact.png`,
          platform: 'joint',
          os: 'Android 15 and iOS 26.4',
          device: 'Android Emulator and iPhone 17 Pro',
          width: 572,
          height: 622,
        }),
        {
          actualBytes: 1024,
          header: Buffer.from('GIF89a'),
          probe: {width: 572, height: 622, fps: 10, durationSeconds: 24},
        },
      ),
    ).not.toThrow();
  });
});
