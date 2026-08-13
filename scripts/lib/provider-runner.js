const path = require('node:path');
const {validateProviderEvidence} = require('./provider-validation.js');

function iosLaunchCommand({device, appId, scenario}) {
  return {
    command: 'xcrun',
    args: [
      'simctl',
      'launch',
      '--terminate-running-process',
      device,
      appId,
      '-AirgapProviderScenario',
      scenario,
    ],
  };
}

function androidLaunchCommand({device, scenario, adb = 'adb'}) {
  return {
    command: adb,
    args: [
      '-s',
      device,
      'shell',
      'am',
      'start',
      '-S',
      '-n',
      'com.airgap/.MainActivity',
      '--es',
      'airgapProviderScenario',
      scenario,
    ],
  };
}

function stateLabel(platform, capability) {
  if (platform === 'ios') {
    if (capability.state === 'available') return 'Ready';
    return capability.reason === 'modelNotReady' ? 'Not ready' : 'Unavailable';
  }
  return {
    AVAILABLE: 'Ready',
    DOWNLOADABLE: 'Download needed',
    DOWNLOADING: 'Downloading',
    UNAVAILABLE: 'Unavailable',
    UNSUPPORTED_OS: 'Unavailable',
  }[capability.state];
}

function escapeMaestroRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function maestroValues({platform, appId, scenario}) {
  const capability = scenario.capabilities[platform];
  const expectedResult = scenario.generation.text ?? "Here's what I found";
  return {
    APP_ID: appId,
    PROVIDER_NAME: platform === 'ios' ? 'Apple on-device model' : 'Android system AI',
    PROVIDER_STATE: stateLabel(platform, capability),
    EXPECTED_RESULT: expectedResult,
    EXPECTED_RESULT_REGEX: `.*${escapeMaestroRegex(expectedResult)}.*`,
  };
}

function reportPath(root, platform, scenario, startedAt) {
  const timestamp = startedAt.replace(/[-:.]/g, '');
  return path.join(
    root,
    'tmp',
    'provider-validation',
    `${platform}-simulated-${scenario}-${timestamp}.json`,
  );
}

function buildScenarioReport({platform, scenario, facts, context}) {
  const capability = scenario.capabilities[platform];
  return validateProviderEvidence({
    schemaVersion: 1,
    evidenceClass: 'simulated-provider',
    providerId: platform === 'ios' ? 'apple-foundation-models' : 'android-aicore',
    modelIdentity:
      capability.modelIdentity ??
      (platform === 'ios' ? 'simulated/apple-system-model' : 'simulated/google-gemini-nano'),
    platform,
    deviceClass: platform === 'ios' ? 'simulator' : 'emulator',
    device: facts.device,
    osVersion: facts.osVersion,
    osBuild: facts.osBuild ?? 'unknown',
    appCommit: context.appCommit,
    promptPackVersion: 'provider-scenarios-v1',
    knowledgeVersion: 'built-in',
    caseId: scenario.id,
    startedAt: context.startedAt,
    durationMs: context.durationMs,
    status: 'passed',
    generationMethod: 'script',
    captureCommand: context.captureCommand,
  });
}

module.exports = {
  androidLaunchCommand,
  buildScenarioReport,
  iosLaunchCommand,
  maestroValues,
  reportPath,
};
