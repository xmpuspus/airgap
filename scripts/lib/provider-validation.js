const fs = require('node:fs');
const path = require('node:path');

const PROVIDER_EVIDENCE_CLASSES = Object.freeze([
  'deterministic-runtime',
  'host-native-model',
  'simulated-provider',
  'target-device',
]);

const PLATFORMS = new Set(['android', 'ios']);
const REPORT_PLATFORMS = new Set(['android', 'ios', 'macos']);
const DEVICE_CLASSES = new Set(['emulator', 'host', 'physical-device', 'simulator']);
const STATUSES = new Set(['failed', 'passed', 'unavailable']);
const GENERATION_METHODS = new Set(['deterministic', 'model', 'script']);
const FAILURE_CODES = new Set([
  'background_blocked',
  'busy',
  'cancelled',
  'context_exceeded',
  'generation_failed',
  'model_not_ready',
  'quota_exceeded',
  'unsupported_locale',
]);
const IOS_STATES = new Set(['available', 'unavailable']);
const ANDROID_STATES = new Set([
  'AVAILABLE',
  'DOWNLOADABLE',
  'DOWNLOADING',
  'UNAVAILABLE',
  'UNSUPPORTED_OS',
]);

function fail(code, detail = '') {
  throw new Error(detail ? `${code}:${detail}` : code);
}

function nonEmpty(value) {
  return typeof value === 'string' && Boolean(value.trim());
}

function uniqueSorted(values) {
  return (
    Array.isArray(values) &&
    values.length > 0 &&
    new Set(values).size === values.length &&
    values.join(',') === [...values].sort().join(',')
  );
}

function validateCapability(platform, capability) {
  if (!capability || typeof capability !== 'object') {
    fail('provider_scenario_capability_missing', platform);
  }
  const states = platform === 'ios' ? IOS_STATES : ANDROID_STATES;
  if (!states.has(capability.state)) fail('provider_scenario_state_invalid', platform);
  if (
    capability.modelIdentity !== undefined &&
    (!nonEmpty(capability.modelIdentity) || !capability.modelIdentity.startsWith('simulated/'))
  ) {
    fail('provider_scenario_identity_invalid', platform);
  }
  if (
    capability.contextSize !== undefined &&
    (!Number.isInteger(capability.contextSize) || capability.contextSize <= 0)
  ) {
    fail('provider_scenario_context_invalid', platform);
  }
}

function validateGeneration(generation) {
  if (!generation || typeof generation !== 'object') fail('provider_scenario_generation_missing');
  const hasError = nonEmpty(generation.error);
  const hasText = nonEmpty(generation.text);
  if (hasError === hasText) fail('provider_scenario_generation_invalid');
  if (hasError && !FAILURE_CODES.has(generation.error)) {
    fail('provider_scenario_error_invalid', generation.error);
  }
  if (hasText) {
    if (
      !Array.isArray(generation.tokens) ||
      generation.tokens.length === 0 ||
      generation.tokens.some(token => !nonEmpty(token)) ||
      generation.tokens.join('') !== generation.text
    ) {
      fail('provider_scenario_tokens_invalid');
    }
  }
}

function validateScenarioManifest(manifest) {
  if (!manifest || manifest.schemaVersion !== 1 || !Array.isArray(manifest.scenarios)) {
    fail('provider_scenario_manifest_invalid');
  }
  const ids = manifest.scenarios.map(scenario => scenario?.id);
  if (!uniqueSorted(ids) || ids.some(id => !/^[a-z][a-z0-9-]+$/.test(id))) {
    fail('provider_scenario_ids_invalid');
  }
  for (const scenario of manifest.scenarios) {
    if (
      !uniqueSorted(scenario.platforms) ||
      scenario.platforms.some(platform => !PLATFORMS.has(platform))
    ) {
      fail('provider_scenario_platforms_invalid', scenario.id);
    }
    for (const platform of scenario.platforms) {
      validateCapability(platform, scenario.capabilities?.[platform]);
    }
    validateGeneration(scenario.generation);
    if (scenario.downloadProgress !== undefined) {
      if (
        !scenario.platforms.includes('android') ||
        !Array.isArray(scenario.downloadProgress) ||
        scenario.downloadProgress.length === 0 ||
        scenario.downloadProgress.some(
          (value, index, values) =>
            !Number.isFinite(value) ||
            value < 0 ||
            value > 1 ||
            (index > 0 && value < values[index - 1]),
        )
      ) {
        fail('provider_scenario_download_progress_invalid', scenario.id);
      }
    }
  }
  return manifest;
}

function loadScenarioManifest(root) {
  const file = path.join(root, 'validation', 'provider-scenarios.json');
  if (!fs.existsSync(file)) fail('provider_scenario_manifest_missing');
  return validateScenarioManifest(JSON.parse(fs.readFileSync(file, 'utf8')));
}

function validateProviderEvidence(report) {
  if (!report || typeof report !== 'object' || report.schemaVersion !== 1) {
    fail('provider_evidence_invalid');
  }
  if (!PROVIDER_EVIDENCE_CLASSES.includes(report.evidenceClass)) {
    fail('provider_evidence_class_invalid');
  }
  for (const field of [
    'providerId',
    'modelIdentity',
    'platform',
    'deviceClass',
    'device',
    'osVersion',
    'osBuild',
    'promptPackVersion',
    'knowledgeVersion',
    'caseId',
    'captureCommand',
  ]) {
    if (!nonEmpty(report[field])) fail('provider_evidence_field_missing', field);
  }
  if (!REPORT_PLATFORMS.has(report.platform)) fail('provider_evidence_platform_invalid');
  if (!DEVICE_CLASSES.has(report.deviceClass)) fail('provider_evidence_device_class_invalid');
  if (!/^[a-f0-9]{40}$/.test(report.appCommit ?? '')) fail('provider_evidence_commit_invalid');
  if (!Number.isFinite(Date.parse(report.startedAt))) fail('provider_evidence_date_invalid');
  if (!Number.isFinite(report.durationMs) || report.durationMs < 0) {
    fail('provider_evidence_duration_invalid');
  }
  if (!STATUSES.has(report.status)) fail('provider_evidence_status_invalid');
  if (!GENERATION_METHODS.has(report.generationMethod)) {
    fail('provider_evidence_generation_method_invalid');
  }
  if (path.isAbsolute(report.captureCommand) || report.captureCommand.includes('/Users/')) {
    fail('provider_evidence_capture_command_invalid');
  }

  if (report.evidenceClass === 'deterministic-runtime') {
    if (report.generationMethod !== 'deterministic' || report.providerId !== 'demo') {
      fail('provider_evidence_deterministic_method_invalid');
    }
  }
  if (report.evidenceClass === 'simulated-provider') {
    if (
      !report.modelIdentity.startsWith('simulated/') ||
      report.generationMethod !== 'script' ||
      !['emulator', 'simulator'].includes(report.deviceClass)
    ) {
      fail('provider_evidence_simulated_identity_invalid');
    }
  }
  if (report.evidenceClass === 'host-native-model') {
    if (report.platform !== 'macos' || report.deviceClass !== 'host') {
      fail('provider_evidence_host_device_invalid');
    }
  }
  if (report.evidenceClass === 'target-device') {
    if (
      report.deviceClass !== 'physical-device' ||
      report.platform === 'macos' ||
      report.osBuild === 'unknown' ||
      report.modelIdentity.startsWith('simulated/') ||
      report.generationMethod !== 'model'
    ) {
      fail('provider_evidence_target_device_invalid');
    }
  }
  return report;
}

module.exports = {
  PROVIDER_EVIDENCE_CLASSES,
  loadScenarioManifest,
  validateProviderEvidence,
  validateScenarioManifest,
};
