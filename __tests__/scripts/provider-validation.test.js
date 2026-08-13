const fs = require('node:fs');
const path = require('node:path');

let providerValidation = {};
try {
  providerValidation = require('../../scripts/lib/provider-validation.js');
} catch {
  // The first TDD run reaches the assertion below before the module exists.
}

const {
  PROVIDER_EVIDENCE_CLASSES,
  loadScenarioManifest,
  validateProviderEvidence,
  validateScenarioManifest,
} = providerValidation;

const SHA = '1234567890abcdef1234567890abcdef12345678';

function report(overrides = {}) {
  return {
    schemaVersion: 1,
    evidenceClass: 'simulated-provider',
    providerId: 'apple-foundation-models',
    modelIdentity: 'simulated/apple-system-model',
    platform: 'ios',
    deviceClass: 'simulator',
    device: 'iPhone 17 Pro Simulator',
    osVersion: '26.4',
    osBuild: 'unknown',
    appCommit: SHA,
    promptPackVersion: '1',
    knowledgeVersion: 'built-in',
    caseId: 'available',
    startedAt: '2026-08-13T12:00:00.000Z',
    durationMs: 10,
    status: 'passed',
    generationMethod: 'script',
    captureCommand: 'npm run providers:scenario -- --platform ios --scenario available',
    ...overrides,
  };
}

describe('provider validation contract', () => {
  test('exports the provider validation API', () => {
    expect(typeof loadScenarioManifest).toBe('function');
    expect(typeof validateScenarioManifest).toBe('function');
    expect(typeof validateProviderEvidence).toBe('function');
  });

  test('loads the complete sorted provider scenario set', () => {
    if (typeof loadScenarioManifest !== 'function') return;
    const manifest = loadScenarioManifest(process.cwd());

    expect(manifest.scenarios.map(item => item.id)).toEqual([
      'available',
      'background-blocked',
      'busy',
      'cancelled',
      'context-exceeded',
      'device-not-eligible',
      'downloadable',
      'downloading',
      'generation-failed',
      'model-not-ready',
      'provider-disabled',
      'quota-exceeded',
      'unsupported-locale',
    ]);
    expect(validateScenarioManifest(manifest)).toBe(manifest);
  });

  test('accepts every provider evidence class with matching facts', () => {
    if (typeof validateProviderEvidence !== 'function') return;
    const cases = [
      report({
        evidenceClass: 'deterministic-runtime',
        providerId: 'demo',
        modelIdentity: 'document-formatter-v1',
        generationMethod: 'deterministic',
      }),
      report(),
      report({
        evidenceClass: 'host-native-model',
        platform: 'macos',
        deviceClass: 'host',
        device: 'Mac',
        modelIdentity: 'apple-system-model/macOS-26.5',
        generationMethod: 'model',
      }),
      report({
        evidenceClass: 'target-device',
        platform: 'android',
        deviceClass: 'physical-device',
        device: 'Pixel 9 Pro',
        osVersion: '16',
        osBuild: 'BP2A.260705.008',
        providerId: 'android-aicore',
        modelIdentity: 'gemini-nano-v3/aicore',
        generationMethod: 'model',
      }),
    ];

    expect(cases.map(validateProviderEvidence)).toEqual(cases);
    expect(PROVIDER_EVIDENCE_CLASSES).toEqual([
      'deterministic-runtime',
      'host-native-model',
      'simulated-provider',
      'target-device',
    ]);
  });

  test.each([
    ['provider_evidence_simulated_identity_invalid', report({modelIdentity: 'apple-system-model'})],
    [
      'provider_evidence_host_device_invalid',
      report({
        evidenceClass: 'host-native-model',
        platform: 'ios',
        deviceClass: 'physical-device',
        device: 'iPhone 17 Pro',
        generationMethod: 'model',
      }),
    ],
    [
      'provider_evidence_target_device_invalid',
      report({
        evidenceClass: 'target-device',
        platform: 'android',
        deviceClass: 'emulator',
        device: 'sdk_gphone64_arm64',
        modelIdentity: 'gemini-nano-v3/aicore',
        generationMethod: 'model',
      }),
    ],
    [
      'provider_evidence_deterministic_method_invalid',
      report({
        evidenceClass: 'deterministic-runtime',
        providerId: 'demo',
        modelIdentity: 'document-formatter-v1',
        generationMethod: 'model',
      }),
    ],
  ])('rejects %s', (code, value) => {
    if (typeof validateProviderEvidence !== 'function') return;
    expect(() => validateProviderEvidence(value)).toThrow(code);
  });

  test('keeps generated provider reports out of Git', () => {
    const ignore = fs.readFileSync(path.join(process.cwd(), '.gitignore'), 'utf8');
    expect(ignore.split(/\r?\n/)).toContain('/tmp/');
  });
});
