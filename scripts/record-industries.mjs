#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import recordingHelpers from './lib/recordings.js';
import {currentCommit, evidenceDirectory, run} from './recording-utils.mjs';

const {replaceKnowledgeData, selectIndustryQuickReply} = recordingHelpers;

const INDUSTRIES = [
  ['airline', 'airline'],
  ['banking', 'banking'],
  ['electric-utility', 'electric'],
  ['healthcare', 'healthcare'],
  ['insurance', 'insurance'],
  ['telco', 'telco'],
  ['water-utility', 'water'],
];

function rootFromScript() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function replaceDirectory(source, target) {
  fs.rmSync(target, {recursive: true, force: true});
  fs.cpSync(source, target, {recursive: true});
}

function main() {
  const root = rootFromScript();
  const device = valueAfter('--device');
  if (!device) throw new Error('recording_device_required');
  const sourceCommit = valueAfter('--commit') ?? currentCommit(root);
  const evidence = evidenceDirectory(root, sourceCommit);
  const configPath = path.join(root, 'airgap.config.json');
  const knowledgePath = path.join(root, 'src', 'knowledge');
  const backupConfig = fs.readFileSync(configPath);
  const backupKnowledge = path.join(evidence, 'default-knowledge-backup');
  replaceDirectory(knowledgePath, backupKnowledge);

  const restore = () => {
    fs.writeFileSync(configPath, backupConfig);
    replaceDirectory(backupKnowledge, knowledgePath);
  };
  process.once('SIGINT', () => {
    restore();
    process.exit(130);
  });
  process.once('SIGTERM', () => {
    restore();
    process.exit(143);
  });

  try {
    for (const [industry, slug] of INDUSTRIES) {
      const example = path.join(root, 'examples', industry);
      const configSource = path.join(example, 'airgap.config.json');
      const config = JSON.parse(fs.readFileSync(configSource, 'utf8'));
      fs.copyFileSync(configSource, configPath);
      replaceKnowledgeData(path.join(example, 'knowledge'), knowledgePath);
      run('node', ['scripts/generate-manifest.js'], {cwd: root});
      run(
        'node',
        [
          'scripts/record-demo.mjs',
          '--platform',
          'android',
          '--device',
          device,
          '--commit',
          sourceCommit,
          '--id',
          `industry-${slug}`,
          '--flow',
          'industry-android.yaml',
          '--kind',
          'industry',
          '--output',
          `demo/industry-${slug}.gif`,
          '--config',
          `examples/${industry}/airgap.config.json`,
          '--quick-reply',
          selectIndustryQuickReply(config),
          '--provider',
          'demo',
          '--model-identity',
          'document-formatter-v1',
          '--evidence-class',
          'emulator',
        ],
        {cwd: root},
      );
    }
  } finally {
    restore();
  }
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
