#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {
  currentCommit,
  relativeToRoot,
  run,
  runMaestro,
} from './recording-utils.mjs';

const require = createRequire(import.meta.url);
const {loadScenarioManifest} = require('./lib/provider-validation.js');
const {
  androidLaunchCommand,
  buildScenarioReport,
  iosLaunchCommand,
  maestroValues,
  reportPath,
} = require('./lib/provider-runner.js');

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
  const candidates = [
    sdkRoot ? path.join(sdkRoot, 'platform-tools', 'adb') : undefined,
    path.join(os.homedir(), 'Library', 'Android', 'sdk', 'platform-tools', 'adb'),
  ].filter(Boolean);
  return candidates.find(candidate => fs.existsSync(candidate)) ?? 'adb';
}

function shellArgument(value) {
  return /^[A-Za-z0-9_./:=+-]+$/.test(value) ? value : JSON.stringify(value);
}

function captureCommand(argv) {
  return ['npm', 'run', 'providers:scenario', '--', ...argv].map(shellArgument).join(' ');
}

function resetIos(root, device, appId) {
  spawnSync('xcrun', ['simctl', 'terminate', device, appId], {stdio: 'ignore'});
  const container = run('xcrun', ['simctl', 'get_app_container', device, appId, 'data'], {
    cwd: root,
    capture: true,
  });
  const expected = `${path.sep}CoreSimulator${path.sep}Devices${path.sep}${device}${path.sep}`;
  if (!path.isAbsolute(container) || !container.includes(expected)) {
    throw new Error('provider_scenario_ios_container_invalid');
  }
  for (const relative of ['Documents/mmkv', 'Library/Preferences']) {
    fs.rmSync(path.join(container, relative), {recursive: true, force: true});
  }
}

function iosFacts(root, device) {
  const list = JSON.parse(
    run('xcrun', ['simctl', 'list', 'devices', '--json'], {cwd: root, capture: true}),
  );
  for (const [runtime, devices] of Object.entries(list.devices ?? {})) {
    const match = devices.find(item => item.udid === device);
    if (!match) continue;
    const osVersion = runtime.match(/iOS-(\d+)-(\d+)/)?.slice(1).join('.') ?? runtime;
    return {device: `${match.name} Simulator`, osVersion, osBuild: 'unknown'};
  }
  throw new Error('provider_scenario_ios_device_unknown');
}

function androidFacts(root, device, adb) {
  const prop = name =>
    run(adb, ['-s', device, 'shell', 'getprop', name], {cwd: root, capture: true});
  return {
    device: prop('ro.product.model') || device,
    osVersion: prop('ro.build.version.release'),
    osBuild: prop('ro.build.id') || 'unknown',
  };
}

function main(argv = process.argv.slice(2)) {
  const root = rootFromScript();
  const args = parseArgs(argv);
  if (!['android', 'ios'].includes(args.platform)) throw new Error('provider_scenario_platform_required');
  if (!args.scenario) throw new Error('provider_scenario_name_required');
  if (!args.device) throw new Error('provider_scenario_device_required');
  run('git', ['diff', '--quiet', 'HEAD', '--'], {cwd: root, capture: true});

  const manifest = loadScenarioManifest(root);
  const scenario = manifest.scenarios.find(item => item.id === args.scenario);
  if (!scenario) throw new Error('provider_scenario_name_unknown');
  if (!scenario.platforms.includes(args.platform)) {
    throw new Error('provider_scenario_platform_unsupported');
  }

  const platform = args.platform;
  const appId =
    args['app-id'] ??
    (platform === 'ios' ? 'org.reactjs.native.example.Airgap' : 'com.airgap');
  const startedAt = new Date().toISOString();
  const outputDirectory = path.join(
    root,
    'tmp',
    'provider-validation',
    `${platform}-${scenario.id}-maestro`,
  );
  const shotPrefix = path.join(outputDirectory, `${platform}-${scenario.id}`).split(path.sep).join('/');

  let launch;
  let facts;
  if (platform === 'ios') {
    resetIos(root, args.device, appId);
    launch = iosLaunchCommand({device: args.device, appId, scenario: scenario.id});
    facts = iosFacts(root, args.device);
  } else {
    const adb = adbCommand();
    run(adb, ['-s', args.device, 'shell', 'pm', 'clear', appId], {cwd: root, capture: true});
    launch = androidLaunchCommand({device: args.device, scenario: scenario.id, adb});
    facts = androidFacts(root, args.device, adb);
  }

  const started = Date.now();
  run(launch.command, launch.args, {cwd: root});
  runMaestro({
    root,
    flow: path.join(root, 'scripts', 'recording-flows', `provider-scenario-${platform}.yaml`),
    device: args.device,
    outputDirectory,
    values: {
      ...maestroValues({platform, appId, scenario}),
      SHOT_PREFIX: shotPrefix,
    },
  });

  const report = buildScenarioReport({
    platform,
    scenario,
    facts,
    context: {
      appCommit: currentCommit(root),
      startedAt,
      durationMs: Date.now() - started,
      captureCommand: captureCommand(argv),
    },
  });
  const file = reportPath(root, platform, scenario.id, startedAt);
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${relativeToRoot(root, file)}\n`);
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
