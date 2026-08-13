#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {run} from './recording-utils.mjs';

const require = createRequire(import.meta.url);
const {placementCommands, verifyModelFile} = require('./lib/android-model-preparation.js');

function rootFromScript() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (!argv[index].startsWith('--')) continue;
    values[argv[index].slice(2)] = argv[index + 1];
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

function main(argv = process.argv.slice(2)) {
  const root = rootFromScript();
  const args = parseArgs(argv);
  if (!args.device) throw new Error('provider_android_device_required');
  const config = JSON.parse(fs.readFileSync(path.join(root, 'airgap.config.json'), 'utf8'));
  const model = verifyModelFile(args.model, config.model);
  const commands = placementCommands({adb: adbCommand(), device: args.device, model});
  try {
    for (const step of commands.steps) {
      const output = run(step.command, step.args, {cwd: root, capture: step.capture});
      if (step.capture && output.split(/\s+/)[0] !== model.sha256) {
        throw new Error('provider_android_model_device_sha256_invalid');
      }
    }
  } finally {
    run(commands.cleanup.command, commands.cleanup.args, {cwd: root, capture: true});
  }
  process.stdout.write(`Prepared ${model.filename} for com.airgap on ${args.device}.\n`);
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
