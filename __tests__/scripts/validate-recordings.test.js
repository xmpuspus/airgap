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
    providerId: 'demo',
    modelIdentity: 'document-formatter-v1',
    evidenceClass: 'emulator',
    providerEvidenceClass: 'deterministic-runtime',
    captureCommand:
      'node scripts/record-demo.mjs --platform android --device emulator-5554 --provider demo --model-identity document-formatter-v1 --evidence-class emulator',
    config: 'airgap.config.json',
    capturedAt: '2026-08-12T12:00:00.000Z',
    width: 360,
    height: 800,
    fps: 10,
    durationSeconds: 24,
    bytes: 1024,
    playbackSpeed: 1,
    omittedSourceRangesSeconds: [],
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
    expect(gifFilter({fps: 10, width: 360, colors: 96, playbackSpeed: 4})).toBe(
      'setpts=PTS/4,fps=10,scale=360:-2:flags=lanczos,split[s0][s1];' +
        '[s0]palettegen=max_colors=96:stats_mode=diff[p];' +
        '[s1][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle',
    );
  });

  test('records an omitted development-overlay interval in the GIF filter', () => {
    expect(
      gifFilter({
        fps: 10,
        width: 360,
        colors: 96,
        playbackSpeed: 4,
        omittedSourceRangesSeconds: [[107, 114]],
      }),
    ).toBe(
      '[0:v]trim=end=107,setpts=PTS-STARTPTS[segment0];' +
        '[0:v]trim=start=114,setpts=PTS-STARTPTS[segment1];' +
        '[segment0][segment1]concat=n=2:v=1:a=0,' +
        'setpts=PTS/4,fps=10,scale=360:-2:flags=lanczos,split[s0][s1];' +
        '[s0]palettegen=max_colors=96:stats_mode=diff[p];' +
        '[s1][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle',
    );
  });

  test('rebuilds public GIFs from retained source videos', () => {
    const script = fs.readFileSync(
      path.join(process.cwd(), 'scripts/rebuild-recording-gifs.mjs'),
      'utf8',
    );

    expect(script).toContain("recording.kind === 'industry' || recording.platform === 'android'");
    expect(script).toContain('convertToGif({');
    expect(script).toContain('build-readme-gif.mjs');
    expect(script).toMatch(/run\(\s*process\.execPath/);
    expect(script).toContain('loopReviewed: false');
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

  test('gives a cold industry reload enough time to reach onboarding', () => {
    const flow = fs.readFileSync(
      path.join(process.cwd(), 'scripts/recording-flows/industry-android.yaml'),
      'utf8',
    );

    expect(flow).toMatch(/element:\n\s+text: 'Try Offline Demo'\n\s+index: 1[\s\S]*timeout: 40000/);
  });

  test('can record one named industry after an interrupted batch', () => {
    const script = fs.readFileSync(
      path.join(process.cwd(), 'scripts/record-industries.mjs'),
      'utf8',
    );

    expect(script).toContain("const requestedIndustry = valueAfter('--industry');");
    expect(script).toContain('throw new Error(`recording_industry_unknown:${requestedIndustry}`)');
    expect(script).toContain('const industries = requestedIndustry');
  });

  test('dismisses the Android keyboard before tapping the send button', () => {
    const flow = fs.readFileSync(
      path.join(process.cwd(), 'scripts/recording-flows/demo-android.yaml'),
      'utf8',
    );

    expect(flow).toMatch(/inputText: 'Create a ticket'\n- hideKeyboard\n- tapOn: 'Send message'/);
    expect(flow).not.toContain("inputText: 'Check my balance'");
    expect(flow).toMatch(/tapOn: 'Send message'\n- extendedWaitUntil:\n\s+visible: 'Queued'/);
  });

  test('clears Android development notices after changing airplane mode', () => {
    const flow = fs.readFileSync(
      path.join(process.cwd(), 'scripts/recording-flows/demo-android.yaml'),
      'utf8',
    );

    expect(flow).toMatch(
      /setAirplaneMode: enabled\n- waitForAnimationToEnd\n- tapOn:\n\s+id: 'com\.airgap:id\/dismiss_button'\n\s+optional: true\n- tapOn:\n\s+point: '93%,92%'\n\s+optional: true\n- extendedWaitUntil:\n\s+notVisible: 'Open debugger to view warnings\\.'\n\s+timeout: 10000\n- tapOn: 'Support question'/,
    );
  });

  test('stops the iOS GIF after the grounded answer', () => {
    const flow = fs.readFileSync(
      path.join(process.cwd(), 'scripts/recording-flows/demo-ios.yaml'),
      'utf8',
    );

    expect(flow).toMatch(
      /takeScreenshot: \$\{SHOT_PREFIX\}-answer-source[\s\S]*takeScreenshot: \$\{SHOT_PREFIX\}-answer-provenance\n- waitForAnimationToEnd\n- stopRecording\s*$/,
    );
  });

  test.each(['demo-android.yaml'])(
    '%s retries header navigation taps when the screen does not change',
    flowName => {
      const flow = fs.readFileSync(
        path.join(process.cwd(), 'scripts/recording-flows', flowName),
        'utf8',
      );

      expect(flow).toMatch(/point: '80%,10%'\n\s+retryTapIfNoChange: true/);
      expect(flow).toMatch(/text: 'Open settings'\n\s+retryTapIfNoChange: true/);
      expect(flow).toMatch(/extendedWaitUntil:\n\s+visible: 'Outbox(?: is clear)?'/);
    },
  );

  test('captures iOS Settings in a separate evidence flow', () => {
    const flow = fs.readFileSync(
      path.join(process.cwd(), 'scripts/recording-flows/demo-ios-evidence.yaml'),
      'utf8',
    );

    expect(flow).toMatch(/point: '93%,10%'\n\s+retryTapIfNoChange: true/);
    expect(flow).toMatch(/extendedWaitUntil:\n\s+visible: 'Settings'/);
    expect(flow).toContain('takeScreenshot: ${SHOT_PREFIX}-provider-settings');
    expect(flow).toContain('takeScreenshot: ${SHOT_PREFIX}-privacy');
  });

  test('runs a platform evidence flow when one exists', () => {
    const script = fs.readFileSync(path.join(process.cwd(), 'scripts/record-demo.mjs'), 'utf8');

    expect(script).toContain('`demo-${platform}-evidence.yaml`');
    expect(script).toContain('fs.existsSync(evidenceFlow)');
  });

  test('builds contact sheets from exact first, middle, and final frames', () => {
    const script = fs.readFileSync(path.join(process.cwd(), 'scripts/recording-utils.mjs'), 'utf8');

    expect(script).toContain('const middle = Math.max(duration / 2, 0)');
    expect(script).toContain('const final = Math.max(duration - 0.2, 0)');
    expect(script).toContain('[0:v]split=3[firstSource][middleSource][finalSource]');
    expect(script).toContain('setpts=PTS-STARTPTS');
    expect(script).toContain('[first][middle][final]hstack=inputs=3[v]');
  });

  test('keeps maintainer-specific paths out of recording tools', () => {
    const demoScript = fs.readFileSync(path.join(process.cwd(), 'scripts/record-demo.mjs'), 'utf8');
    const utilityScript = fs.readFileSync(
      path.join(process.cwd(), 'scripts/recording-utils.mjs'),
      'utf8',
    );

    expect(demoScript).not.toContain('/Users/');
    expect(utilityScript).not.toContain('/Users/');
  });

  test.each(['demo-android.yaml', 'demo-ios.yaml', 'industry-android.yaml'])(
    '%s waits for the configured demo provider provenance',
    flowName => {
      const flow = fs.readFileSync(
        path.join(process.cwd(), 'scripts/recording-flows', flowName),
        'utf8',
      );

      expect(flow).toContain("visible: 'Document answer'");
      expect(flow).not.toContain("visible: 'On-device model'");
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
      validateManifest({schemaVersion: 2, recordings: [record({sourceCommit: ''})]}),
    ).toThrow('recording_commit_missing');
  });

  test('requires every release recording path', () => {
    expect(() => validateManifest({schemaVersion: 2, recordings: [record()]})).toThrow(
      'recording_output_missing',
    );
    expect(REQUIRED_OUTPUTS).toHaveLength(10);
  });

  test.each([
    ['providerId', undefined, 'recording_provider_missing'],
    ['modelIdentity', undefined, 'recording_model_identity_missing'],
    ['captureCommand', undefined, 'recording_capture_command_missing'],
    ['providerEvidenceClass', undefined, 'recording_provider_evidence_class_invalid'],
  ])('requires %s evidence metadata', (field, value, expected) => {
    expect(() => validateRecording(record({[field]: value}))).toThrow(expected);
  });

  test('keeps capture hardware separate from provider proof', () => {
    expect(() => validateRecording(record({providerEvidenceClass: 'unknown'}))).toThrow(
      'recording_provider_evidence_class_invalid',
    );
    expect(() => validateRecording(record({providerEvidenceClass: 'target-device'}))).toThrow(
      'recording_provider_evidence_target_invalid',
    );
    expect(() =>
      validateRecording(
        record({
          providerEvidenceClass: 'simulated-provider',
          modelIdentity: 'apple-system-model',
        }),
      ),
    ).toThrow('recording_provider_evidence_simulated_invalid');
  });

  test('labels all current release recordings as the deterministic runtime', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'demo', 'recordings.json'), 'utf8'),
    );

    expect(validateManifest(manifest).recordings).toHaveLength(10);
    expect(new Set(manifest.recordings.map(item => item.providerEvidenceClass))).toEqual(
      new Set(['deterministic-runtime']),
    );
  });

  test('requires a bounded public playback speed', () => {
    expect(() => validateRecording(record({playbackSpeed: 0}))).toThrow(
      'recording_playback_speed_invalid',
    );
    expect(() => validateRecording(record({playbackSpeed: 9}))).toThrow(
      'recording_playback_speed_invalid',
    );
  });

  test('requires ordered non-overlapping omitted source ranges', () => {
    expect(() => validateRecording(record({omittedSourceRangesSeconds: [[114, 107]]}))).toThrow(
      'recording_omitted_range_invalid',
    );
    expect(() =>
      validateRecording(
        record({
          omittedSourceRangesSeconds: [
            [10, 20],
            [19, 21],
          ],
        }),
      ),
    ).toThrow('recording_omitted_range_invalid');
  });

  test('rejects simulator or emulator footage labeled as a physical device', () => {
    expect(() =>
      validateRecording(
        record({
          device: 'Android Emulator',
          evidenceClass: 'physical-device',
        }),
      ),
    ).toThrow('recording_evidence_class_invalid');
  });

  test('rejects the old recording manifest schema', () => {
    expect(() => validateManifest({schemaVersion: 1, recordings: []})).toThrow(
      'recording_manifest_invalid',
    );
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
          evidenceClass: ['emulator', 'simulator'],
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
