const path = require('node:path');
const {validateProviderEvidence} = require('./provider-validation.js');

function fail(code) {
  throw new Error(code);
}

function parseRunnerLine(line) {
  try {
    const parsed = JSON.parse(line);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
      fail('apple_host_runner_output_invalid');
    }
    return parsed;
  } catch (error) {
    if (error.message === 'apple_host_runner_output_invalid') throw error;
    fail('apple_host_runner_output_invalid');
  }
}

function buildHostReport(raw, context, evaluationCase) {
  if (!raw || !['probe', 'case'].includes(raw.type)) fail('apple_host_runner_output_invalid');
  if (raw.type === 'case' && (!evaluationCase || evaluationCase.id !== raw.caseId)) {
    fail('apple_host_case_unknown');
  }
  const isProbe = raw.type === 'probe';
  const report = {
    schemaVersion: 1,
    evidenceClass: 'host-native-model',
    providerId: 'apple-foundation-models',
    modelIdentity: raw.modelIdentity,
    platform: 'macos',
    deviceClass: 'host',
    device: raw.device,
    osVersion: raw.osVersion,
    osBuild: raw.osBuild,
    appCommit: context.appCommit,
    promptPackVersion: isProbe ? 'availability-v1' : evaluationCase.promptPackVersion,
    knowledgeVersion: isProbe ? 'none' : evaluationCase.knowledgeVersion,
    caseId: isProbe ? 'availability-probe' : raw.caseId,
    startedAt: context.startedAt,
    durationMs: isProbe ? raw.durationMs : raw.totalTimeMs,
    status: isProbe ? (raw.availability === 'available' ? 'passed' : 'unavailable') : raw.status,
    generationMethod: 'model',
    captureCommand: context.captureCommand,
    availability: raw.availability,
    availabilityReason: raw.availabilityReason,
    localeSupported: raw.localeSupported,
    contextSize: raw.contextSize,
  };
  for (const field of ['text', 'error', 'firstTokenTimeMs', 'totalTimeMs', 'outputLength']) {
    if (raw[field] !== undefined) report[field] = raw[field];
  }
  return validateProviderEvidence(report);
}

function outputPath(root, startedAt, kind) {
  const timestamp = startedAt.replace(/[-:.]/g, '');
  return path.join(root, 'tmp', 'provider-validation', `apple-host-${kind}-${timestamp}.json`);
}

module.exports = {buildHostReport, outputPath, parseRunnerLine};
