#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {relativeToRoot, run} from './recording-utils.mjs';

const require = createRequire(import.meta.url);
const {
  assessAndroidTarget,
  assessFirebaseTarget,
  assessIosTarget,
} = require('./lib/provider-device-preflight.js');

function rootFromScript() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith('--')) continue;
    if (argument === '--execute' || argument === '--firebase') {
      values[argument.slice(2)] = true;
      continue;
    }
    values[argument.slice(2)] = argv[index + 1];
    index += 1;
  }
  return values;
}

function adbCommand() {
  const sdkRoot = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
  const candidates = [
    sdkRoot ? path.join(sdkRoot, 'platform-tools', 'adb') : undefined,
    path.join(os.homedir(), 'Library', 'Android', 'sdk', 'platform-tools', 'adb'),
  ].filter(Boolean);
  return candidates.find(candidate => fs.existsSync(candidate)) ?? 'adb';
}

function commandPath(command) {
  const result = spawnSync('/usr/bin/which', [command], {encoding: 'utf8'});
  return result.status === 0 ? result.stdout.trim() : undefined;
}

function androidFacts(root, device) {
  const adb = adbCommand();
  const prop = name =>
    run(adb, ['-s', device, 'shell', 'getprop', name], {cwd: root, capture: true});
  const packageResult = spawnSync(
    adb,
    ['-s', device, 'shell', 'pm', 'path', 'com.google.android.aicore'],
    {cwd: root, encoding: 'utf8'},
  );
  return {
    serial: device,
    model: prop('ro.product.model'),
    manufacturer: prop('ro.product.manufacturer'),
    fingerprint: prop('ro.build.fingerprint'),
    qemu: prop('ro.kernel.qemu'),
    osVersion: prop('ro.build.version.release'),
    osBuild: prop('ro.build.id'),
    bootloader: prop('ro.bootloader') || 'unreadable',
    verifiedBootState: prop('ro.boot.verifiedbootstate') || 'unreadable',
    aicorePackage: packageResult.status === 0 ? packageResult.stdout.trim() : '',
    providerAbility: 'not-probed',
  };
}

function iosFacts(root, device) {
  const simulators = JSON.parse(
    run('xcrun', ['simctl', 'list', 'devices', '--json'], {cwd: root, capture: true}),
  );
  for (const [runtime, devices] of Object.entries(simulators.devices ?? {})) {
    const match = devices.find(item => item.udid === device);
    if (match) {
      return {
        udid: device,
        name: match.name,
        state: match.state,
        runtime,
        simulator: true,
        providerAbility: 'not-probed',
      };
    }
  }
  const details = run(
    'xcrun',
    ['devicectl', 'device', 'info', 'details', '--device', device],
    {cwd: root, capture: true},
  );
  return {udid: device, simulator: false, details, providerAbility: 'not-probed'};
}

function firebaseFacts(root, args) {
  const gcloudPath = commandPath('gcloud');
  const project =
    args.project ??
    (gcloudPath
      ? run(gcloudPath, ['config', 'get-value', 'project'], {cwd: root, capture: true})
      : undefined);
  return {
    gcloudPath,
    project,
    model: args.model,
    modelForm: args.form,
    execute: args.execute === true,
  };
}

function reportFile(root, platform) {
  const timestamp = new Date().toISOString().replace(/[-:.]/g, '');
  return path.join(root, 'tmp', 'provider-validation', `${platform}-target-preflight-${timestamp}.json`);
}

function writeReport(root, platform, facts, eligible, error) {
  const file = reportFile(root, platform);
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(
    file,
    `${JSON.stringify(
      {schemaVersion: 1, kind: 'target-preflight', platform, eligible, error, facts},
      null,
      2,
    )}\n`,
  );
  process.stdout.write(`${relativeToRoot(root, file)}\n`);
}

function main(argv = process.argv.slice(2)) {
  const root = rootFromScript();
  const args = parseArgs(argv);
  const platform = args.firebase ? 'firebase-android' : args.platform;
  if (!['android', 'ios', 'firebase-android'].includes(platform)) {
    throw new Error('provider_target_platform_required');
  }
  if (!args.firebase && !args.device) throw new Error('provider_target_device_required');

  const facts =
    platform === 'android'
      ? androidFacts(root, args.device)
      : platform === 'ios'
      ? iosFacts(root, args.device)
      : firebaseFacts(root, args);
  try {
    if (platform === 'android') assessAndroidTarget(facts);
    else if (platform === 'ios') assessIosTarget(facts);
    else assessFirebaseTarget(facts);
    if (platform === 'firebase-android' && args.execute) {
      if (!args.app) throw new Error('provider_firebase_app_required');
      run(
        facts.gcloudPath,
        [
          'firebase',
          'test',
          'android',
          'run',
          '--type',
          'robo',
          '--app',
          args.app,
          '--device',
          `model=${facts.model},version=${args.version},locale=en,orientation=portrait`,
          '--timeout',
          '5m',
        ],
        {cwd: root},
      );
    }
    writeReport(root, platform, facts, true);
  } catch (error) {
    writeReport(root, platform, facts, false, error.message);
    throw error;
  }
}

export {main, parseArgs};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
