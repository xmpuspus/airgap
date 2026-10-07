#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import recordingHelpers from './lib/recordings.js';
import {currentCommit, evidenceDirectory, run} from './recording-utils.mjs';

const {replaceKnowledgeData, selectIndustryQuickReply, withLlmMode} = recordingHelpers;

const INDUSTRIES = [
  ['airline', 'airline'],
  ['banking', 'banking'],
  ['electric-utility', 'electric'],
  ['government-services', 'government'],
  ['healthcare', 'healthcare'],
  ['insurance', 'insurance'],
  ['telco', 'telco'],
  ['water-utility', 'water'],
];

// Flows that replay a documented scenario instead of the generic quick-reply walk.
const FLOWS = {
  'government-services': 'government-android.yaml',
};

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
  const platform = valueAfter('--platform') ?? 'android';
  if (!['android', 'ios'].includes(platform)) throw new Error('recording_platform_invalid');
  // An iOS take is a second recording of the same fixture, named by platform.
  const suffix = platform === 'ios' ? '-ios' : '';
  const requestedIndustry = valueAfter('--industry');
  const requestedEntry = INDUSTRIES.find(([industry]) => industry === requestedIndustry);
  if (requestedIndustry && !requestedEntry) {
    throw new Error(`recording_industry_unknown:${requestedIndustry}`);
  }
  const industries = requestedIndustry ? [requestedEntry] : INDUSTRIES;
  const sourceCommit = valueAfter('--commit') ?? currentCommit(root);
  // One real provider for a take. The shipped fixture stays in demo mode.
  const llmMode = valueAfter('--llm-mode') ?? 'demo';
  const provider = valueAfter('--provider') ?? 'demo';
  const modelIdentity = valueAfter('--model-identity') ?? 'document-formatter-v1';
  const modelFile = valueAfter('--model-file');
  const flowOverride = valueAfter('--flow');
  if (modelFile && !requestedIndustry) throw new Error('recording_model_file_needs_industry');
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
    for (const [industry, slug] of industries) {
      const example = path.join(root, 'examples', industry);
      const configSource = path.join(example, 'airgap.config.json');
      const config = JSON.parse(fs.readFileSync(configSource, 'utf8'));
      if (llmMode === 'demo') {
        fs.copyFileSync(configSource, configPath);
      } else {
        const switched = withLlmMode(config, llmMode, provider);
        fs.writeFileSync(configPath, `${JSON.stringify(switched, null, 2)}\n`);
      }
      replaceKnowledgeData(path.join(example, 'knowledge'), knowledgePath);
      run('node', ['scripts/generate-manifest.js'], {cwd: root});
      run(
        'node',
        [
          'scripts/record-demo.mjs',
          '--platform',
          platform,
          '--device',
          device,
          '--commit',
          sourceCommit,
          '--id',
          `industry-${slug}${suffix}`,
          '--flow',
          flowOverride ?? FLOWS[industry] ?? 'industry-android.yaml',
          '--kind',
          'industry',
          '--output',
          `demo/industry-${slug}${suffix}.gif`,
          '--config',
          `examples/${industry}/airgap.config.json`,
          '--quick-reply',
          selectIndustryQuickReply(config),
          '--provider',
          provider,
          '--model-identity',
          modelIdentity,
          '--evidence-class',
          platform === 'ios' ? 'simulator' : 'emulator',
          ...(llmMode === 'demo' ? [] : ['--llm-mode', llmMode]),
          ...(modelFile ? ['--model-file', modelFile] : []),
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
