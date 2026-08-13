#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const require = createRequire(import.meta.url);
const {loadScenarioManifest, validateProviderEvidence} = require('./lib/provider-validation.js');

function repositoryRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

function reportsFromFile(file) {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  return Array.isArray(parsed) ? parsed : Array.isArray(parsed.reports) ? parsed.reports : [parsed];
}

function main(argv = process.argv.slice(2)) {
  const root = repositoryRoot();
  const manifest = loadScenarioManifest(root);
  if (argv.includes('--list')) {
    process.stdout.write(`${manifest.scenarios.map(scenario => scenario.id).join('\n')}\n`);
    return;
  }
  const files = argv.filter(argument => !argument.startsWith('--'));
  let count = 0;
  for (const value of files) {
    const file = path.resolve(root, value);
    if (!fs.existsSync(file)) throw new Error(`provider_evidence_file_missing:${value}`);
    for (const report of reportsFromFile(file)) {
      validateProviderEvidence(report);
      count += 1;
    }
  }
  process.stdout.write(
    `Validated ${manifest.scenarios.length} provider scenarios and ${count} evidence report(s).\n`,
  );
}

export {main, reportsFromFile};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
