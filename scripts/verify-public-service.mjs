#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import ts from 'typescript';
import prettier from 'prettier';
import {root, loadPublicRecords, loadPublicPolicy, readJson, sha256} from './public-service.mjs';
import {judgeOutput} from './public-experiment.mjs';
import {verifyPublicArtifacts} from './public-artifacts.mjs';
import {answerPublicService, controlPublicModelOutput} from '../src/core/publicService.ts';

const tests = spawnSync(process.execPath, ['--test', '__tests__/public-service.test.mjs'], {
  cwd: root,
  stdio: 'inherit',
});
if (tests.status !== 0) process.exit(tests.status ?? 1);
const mediaTests = spawnSync('python3', ['-B', '__tests__/public-media.test.py'], {
  cwd: root,
  stdio: 'inherit',
});
assert.equal(mediaTests.status, 0, 'Capture publication regression failed');
const build = spawnSync(process.execPath, ['scripts/build-public-service.mjs', '--check'], {
  cwd: root,
  stdio: 'inherit',
});
assert.equal(build.status, 0, 'Pack or shared browser core is stale');
const report = readJson('evidence/public-service/experiment.json');
const coreFile = path.join(root, 'src/core/publicService.ts');
const compiled = ts.transpileModule(fs.readFileSync(coreFile, 'utf8'), {
  compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022},
}).outputText;
assert.equal(
  fs.readFileSync(path.join(root, 'web/public-core.js'), 'utf8'),
  prettier.format('// Generated from src/core/publicService.ts by public:build.\n' + compiled, {
    ...prettier.resolveConfig.sync(coreFile),
    parser: 'babel',
  }),
  'Browser core differs; run public:build',
);
const pack = readJson('web/data/public-service.json');
assert.deepEqual(pack.records, loadPublicRecords());
assert.deepEqual(pack.experiment, report, 'Browser model results are stale; run public:build');
assert.equal(report.evidenceClass, 'host-native-model');
assert.equal(report.policySha256, sha256(JSON.stringify(loadPublicPolicy())));
assert.equal(
  report.runnerSha256,
  sha256(fs.readFileSync(path.join(root, 'scripts/public-experiment.mjs'))),
  'Re-run experiment after runner changes',
);
assert.equal(
  report.coreSha256,
  sha256(fs.readFileSync(path.join(root, 'src/core/publicService.ts'))),
  'Re-run experiment after core changes',
);
assert.equal(
  report.corpusSha256,
  sha256(JSON.stringify(loadPublicRecords())),
  'Re-run experiment after corpus changes',
);
assert.equal(
  report.criteriaSha256,
  sha256(fs.readFileSync(path.join(root, 'validation/public-service-experiment.json'))),
);
assert.match(report.model.sha256, /^[a-f0-9]{64}$/);
assert.ok(report.model.sizeBytes > 100000000);
assert.equal(report.rows.length, 54);
assert.equal(report.repetitions, 3);
assert.deepEqual(report.criteria, readJson('validation/public-service-experiment.json'));
assert.deepEqual(report.settings, {contextSize: 2048, maxTokens: 160, temperature: 0, seed: 42});
for (const question of report.criteria.questions) {
  for (const fact of [question.sourceFact, ...(question.sourceFacts ?? [])])
    assert.ok(readJson(question.sourcePath).text.includes(fact));
  for (const variant of ['record-only', 'retrieved-model', 'application-controls']) {
    const rows = report.rows.filter(
      row => row.questionId === question.id && row.variant === variant,
    );
    assert.deepEqual(rows.map(row => row.repetition).sort(), [1, 2, 3]);
    for (const row of rows) {
      assert.equal(row.error, null, `Provider NOT RUN: ${row.questionId}`);
      assert.equal(row.modelCalled, variant !== 'record-only');
      assert.ok(Number.isFinite(row.elapsedMs) && row.elapsedMs > 0);
      assert.deepEqual(row.judgment, judgeOutput(question, row.answer));
      const plan = answerPublicService(question.query, loadPublicRecords());
      assert.deepEqual(row.recordIds, plan.recordIds);
      assert.deepEqual(row.sources, plan.sources);
      if (variant === 'record-only') assert.equal(row.answer, plan.answer);
      if (variant !== 'record-only') {
        assert.ok(['eogToken', 'maxTokens', 'stopGenerationTrigger'].includes(row.stopReason));
        assert.equal(row.tokenLimitReached, row.stopReason === 'maxTokens');
        assert.ok(row.rawOutput?.trim(), 'Missing actual model output');
        assert.deepEqual(row.rawJudgment, judgeOutput(question, row.rawOutput));
        if (variant === 'application-controls') {
          const controlled = controlPublicModelOutput(row.rawOutput, plan, loadPublicRecords());
          assert.equal(row.answer, controlled.answer);
          assert.equal(row.fallback, controlled.fallback);
        } else assert.equal(row.answer, row.rawOutput);
      }
    }
  }
}
for (const [variant, summary] of Object.entries(report.summary)) {
  const rows = report.rows.filter(row => row.variant === variant);
  assert.equal(summary.denominator, rows.length);
  assert.equal(summary.passed, rows.filter(row => row.judgment.passed).length);
  assert.equal(summary.fallbacks, rows.filter(row => row.fallback).length);
  assert.equal(summary.falseRefusals, rows.filter(row => row.judgment.falseRefusal).length);
  assert.equal(summary.tokenLimitStops, rows.filter(row => row.tokenLimitReached).length);
  assert.equal(summary.providerErrors, rows.filter(row => row.error).length);
  assert.equal(summary.modelCalls, rows.filter(row => row.modelCalled).length);
  const timings = rows.map(row => row.elapsedMs).sort((a, b) => a - b);
  assert.equal(summary.p50Ms, timings[Math.ceil(timings.length * 0.5) - 1]);
  assert.equal(summary.p95Ms, timings[Math.ceil(timings.length * 0.95) - 1]);
}
process.stdout.write(
  'CLI, exact source bytes, all 54 experiment rows, timings and control decisions verified. Checking five required captures next.\n',
);
verifyPublicArtifacts();
process.stdout.write(
  'Public CLI, sources, experiment outputs, and media checks passed. Visual inspection is a separate required review.\n',
);
