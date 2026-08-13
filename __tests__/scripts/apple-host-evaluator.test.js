const path = require('node:path');

let evaluator = {};
try {
  evaluator = require('../../scripts/lib/apple-host-evaluator.js');
} catch {
  // The first TDD run reaches the export assertion before the wrapper exists.
}

const {buildHostReport, outputPath, parseRunnerLine} = evaluator;
const SHA = '1234567890abcdef1234567890abcdef12345678';

function context(overrides = {}) {
  return {
    appCommit: SHA,
    startedAt: '2026-08-13T12:34:56.789Z',
    captureCommand: 'npm run providers:apple:probe',
    ...overrides,
  };
}

function probe(overrides = {}) {
  return {
    type: 'probe',
    availability: 'unavailable',
    availabilityReason: 'appleIntelligenceNotEnabled',
    localeSupported: true,
    contextSize: 4096,
    modelIdentity: 'apple-system-model/macOS-26.5',
    device: 'MacBookPro18,3',
    osVersion: '26.5',
    osBuild: '25F71',
    durationMs: 7,
    ...overrides,
  };
}

describe('Apple host evaluator', () => {
  test('exports the wrapper contract', () => {
    expect(typeof parseRunnerLine).toBe('function');
    expect(typeof buildHostReport).toBe('function');
    expect(typeof outputPath).toBe('function');
  });

  test('parses one runner JSON line and rejects malformed output', () => {
    if (!parseRunnerLine) return;
    expect(parseRunnerLine(JSON.stringify(probe()))).toMatchObject({type: 'probe'});
    expect(() => parseRunnerLine('not json')).toThrow('apple_host_runner_output_invalid');
    expect(() => parseRunnerLine('[]')).toThrow('apple_host_runner_output_invalid');
  });

  test('marks an unavailable probe as observation rather than model proof', () => {
    if (!buildHostReport) return;
    expect(buildHostReport(probe(), context())).toMatchObject({
      schemaVersion: 1,
      evidenceClass: 'host-native-model',
      providerId: 'apple-foundation-models',
      platform: 'macos',
      deviceClass: 'host',
      caseId: 'availability-probe',
      status: 'unavailable',
      generationMethod: 'model',
      availabilityReason: 'appleIntelligenceNotEnabled',
    });
  });

  test('builds passed reports for known evaluation cases', () => {
    if (!buildHostReport) return;
    const report = buildHostReport(
      {
        ...probe({availability: 'available', availabilityReason: undefined}),
        type: 'case',
        caseId: 'telco-no-signal',
        status: 'passed',
        text: 'Toggle airplane mode for 10 seconds [1].',
        outputLength: 40,
        firstTokenTimeMs: 20,
        totalTimeMs: 45,
      },
      context({captureCommand: 'npm run providers:apple:evaluate'}),
      {
        id: 'telco-no-signal',
        promptPackVersion: 'host-eval-v1',
        knowledgeVersion: 'fictional-support-v1',
      },
    );

    expect(report).toMatchObject({
      caseId: 'telco-no-signal',
      status: 'passed',
      promptPackVersion: 'host-eval-v1',
      knowledgeVersion: 'fictional-support-v1',
      outputLength: 40,
    });
  });

  test('uses a stable timestamped report path', () => {
    if (!outputPath) return;
    expect(outputPath('/repo', '2026-08-13T12:34:56.789Z', 'probe')).toBe(
      path.join('/repo', 'tmp', 'provider-validation', 'apple-host-probe-20260813T123456789Z.json'),
    );
  });
});
