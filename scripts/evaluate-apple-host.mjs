#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {execFileSync, spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const require = createRequire(import.meta.url);
const {buildHostReport, outputPath, parseRunnerLine} = require('./lib/apple-host-evaluator.js');

function repositoryRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

function readCases(root) {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, 'validation', 'apple-host-cases.json'), 'utf8'),
  );
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.cases)) {
    throw new Error('apple_host_cases_invalid');
  }
  return manifest.cases;
}

function main(argv = process.argv.slice(2)) {
  const root = repositoryRoot();
  const probeOnly = argv.includes('--probe');
  const cases = readCases(root);
  const startedAt = new Date().toISOString();
  const captureCommand = probeOnly
    ? 'npm run providers:apple:probe'
    : 'npm run providers:apple:evaluate';
  const input = probeOnly ? '' : `${cases.map(item => JSON.stringify(item)).join('\n')}\n`;
  const result = spawnSync(
    'xcrun',
    ['swift', path.join(root, 'scripts', 'apple-foundation-models-runner.swift'), probeOnly ? '--probe' : '--require-available'],
    {cwd: root, encoding: 'utf8', input},
  );
  if (result.error) throw result.error;

  const rawRecords = result.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map(parseRunnerLine);
  if (rawRecords.length === 0) {
    process.stderr.write(result.stderr);
    throw new Error('apple_host_runner_output_missing');
  }
  const context = {
    appCommit: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim(),
    startedAt,
    captureCommand,
  };
  const reports = rawRecords.map(raw =>
    buildHostReport(
      raw,
      context,
      raw.type === 'case' ? cases.find(item => item.id === raw.caseId) : undefined,
    ),
  );
  const file = outputPath(root, startedAt, probeOnly ? 'probe' : 'evaluation');
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, `${JSON.stringify({schemaVersion: 1, reports}, null, 2)}\n`);
  process.stdout.write(`${path.relative(root, file)}\n`);
  for (const report of reports) {
    process.stdout.write(`${report.caseId}: ${report.status}\n`);
  }
  if (result.status !== 0) {
    if (result.stderr) process.stderr.write(result.stderr);
    throw new Error('apple_host_model_unavailable');
  }
}

export {main, readCases};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
