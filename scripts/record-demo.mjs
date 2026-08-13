#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import recordings from './lib/recordings.js';
import {
  assertCommit,
  convertToGif,
  createContactSheet,
  currentCommit,
  evidenceDirectory,
  probeMedia,
  relativeToRoot,
  run,
  runMaestro,
  upsertRecording,
} from './recording-utils.mjs';

const {maestroRecordingPath} = recordings;

function rootFromScript() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith('--')) continue;
    values[argument.slice(2)] = argv[index + 1];
    index += 1;
  }
  return values;
}

function adbCommand() {
  const sdkRoot = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
  return sdkRoot ? path.join(sdkRoot, 'platform-tools', 'adb') : 'adb';
}

function androidFacts(device) {
  const adb = adbCommand();
  const release = run(adb, ['-s', device, 'shell', 'getprop', 'ro.build.version.release'], {
    capture: true,
  });
  const sdk = run(adb, ['-s', device, 'shell', 'getprop', 'ro.build.version.sdk'], {
    capture: true,
  });
  const model = run(adb, ['-s', device, 'shell', 'getprop', 'ro.product.model'], {capture: true});
  return {os: `Android ${release} API ${sdk}`, device: model || device};
}

function iosFacts(device) {
  const list = JSON.parse(run('xcrun', ['simctl', 'list', 'devices', '--json'], {capture: true}));
  for (const [runtime, devices] of Object.entries(list.devices ?? {})) {
    const match = devices.find(item => item.udid === device);
    if (match) {
      const version =
        runtime
          .match(/iOS-(\d+)-(\d+)/)
          ?.slice(1)
          .join('.') ?? runtime;
      return {os: `iOS ${version}`, device: match.name};
    }
  }
  throw new Error(`recording_ios_device_unknown:${device}`);
}

function inferredEvidenceClass(platform, facts) {
  if (platform === 'ios') return 'simulator';
  return /(emulator|sdk_gphone|generic_x86|virtual device)/i.test(facts.device)
    ? 'emulator'
    : 'physical-device';
}

function shellArgument(value) {
  return /^[A-Za-z0-9_./:=+-]+$/.test(value) ? value : JSON.stringify(value);
}

function captureCommand(argv) {
  return ['node', 'scripts/record-demo.mjs', ...argv].map(shellArgument).join(' ');
}

function main() {
  const root = rootFromScript();
  const args = parseArgs(process.argv.slice(2));
  const platform = args.platform;
  if (!['android', 'ios'].includes(platform)) throw new Error('recording_platform_required');
  if (!args.device) throw new Error('recording_device_required');

  const sourceCommit = args.commit ?? currentCommit(root);
  assertCommit(root, sourceCommit);
  const evidence = evidenceDirectory(root, sourceCommit);
  const id = args.id ?? platform;
  const sourceBase = path.join(evidence, id);
  const source = `${sourceBase}.mp4`;
  const output = path.join(
    root,
    args.output ?? `demo/airgap-demo${platform === 'ios' ? '-ios' : ''}.gif`,
  );
  const contactSheet = path.join(evidence, `${id}-contact.png`);
  const flowName = args.flow ?? `demo-${platform}.yaml`;
  const flow = path.join(root, 'scripts', 'recording-flows', flowName);
  const shotPrefix = path.join(evidence, id).split(path.sep).join('/');
  const recordingPath = maestroRecordingPath(sourceBase);
  const appId =
    args['app-id'] ?? (platform === 'android' ? 'com.airgap' : 'org.reactjs.native.example.Airgap');

  runMaestro({
    root,
    flow,
    device: args.device,
    outputDirectory: path.join(evidence, `${id}-maestro`),
    values: {
      APP_ID: appId,
      RECORDING_PATH: recordingPath,
      SHOT_PREFIX: shotPrefix,
      QUICK_REPLY: args['quick-reply'] ?? 'Check plans',
    },
  });

  const evidenceFlowName = args['evidence-flow'] ?? `demo-${platform}-evidence.yaml`;
  const evidenceFlow = path.join(root, 'scripts', 'recording-flows', evidenceFlowName);
  if (fs.existsSync(evidenceFlow)) {
    runMaestro({
      root,
      flow: evidenceFlow,
      device: args.device,
      outputDirectory: path.join(evidence, `${id}-evidence-maestro`),
      values: {
        APP_ID: appId,
        SHOT_PREFIX: shotPrefix,
      },
    });
  }

  if (!fs.existsSync(source)) throw new Error(`recording_source_missing:${source}`);
  convertToGif({source, output, fps: 10, width: 360, colors: args.kind === 'industry' ? 80 : 96});
  createContactSheet({source, output: contactSheet});
  const probe = probeMedia(output);
  const facts = platform === 'android' ? androidFacts(args.device) : iosFacts(args.device);
  const evidenceClass = args['evidence-class'] ?? inferredEvidenceClass(platform, facts);
  const capturedAt = new Date().toISOString();

  upsertRecording(root, {
    id,
    kind: args.kind ?? 'platform',
    output: relativeToRoot(root, output),
    source: relativeToRoot(root, source),
    contactSheet: relativeToRoot(root, contactSheet),
    script: 'scripts/record-demo.mjs',
    sourceCommit,
    platform,
    os: facts.os,
    device: facts.device,
    mode: 'demo',
    providerId: args.provider ?? 'demo',
    modelIdentity: args['model-identity'] ?? 'document-formatter-v1',
    evidenceClass,
    captureCommand: captureCommand(process.argv.slice(2)),
    config: args.config ?? 'airgap.config.json',
    capturedAt,
    ...probe,
    bytes: fs.statSync(output).size,
    loopReviewed: false,
  });
  process.stdout.write(
    `Recorded ${relativeToRoot(root, output)} from ${relativeToRoot(root, source)}.\n`,
  );
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
