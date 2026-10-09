#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {answerPublicService} from '../src/core/publicService.ts';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
export const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

export function loadSourceArchive(record) {
  const file = record.metadata.sourcePath;
  const bytes = fs.readFileSync(path.join(root, file));
  if (sha256(bytes) !== record.metadata.sourceSha256)
    throw new Error(`Source hash mismatch: ${file}`);
  const source = file.endsWith('.pdf')
    ? readJson(record.metadata.sourceTextPath)
    : JSON.parse(bytes);
  if (file.endsWith('.pdf')) {
    if (
      !bytes.subarray(0, 5).equals(Buffer.from('%PDF-')) ||
      source.sourceSha256 !== sha256(bytes) ||
      source.sourcePath !== file
    )
      throw new Error(`PDF lineage mismatch: ${file}`);
    if (
      sha256(fs.readFileSync(path.join(root, record.metadata.sourceTextPath))) !==
      record.metadata.sourceTextSha256
    )
      throw new Error(`Extraction hash mismatch: ${file}`);
  }
  if (source.url !== record.metadata.source || !source.text.includes(record.metadata.excerpt))
    throw new Error(`Source excerpt or URL mismatch: ${record.id}`);
  return source;
}

export function loadPublicPolicy() {
  const config = readJson('examples/government-services/airgap.config.json');
  return {
    ...config.safety,
    refusalTemplates: Object.fromEntries(
      Object.entries(config.safety.refusalTemplates).map(([key, value]) => [
        key,
        value
          .replaceAll('{{hotline}}', config.brand.hotline)
          .replaceAll('{{brandName}}', config.brand.name),
      ]),
    ),
  };
}

export function loadPublicRecords() {
  const directory = 'examples/government-services/knowledge';
  return fs
    .readdirSync(path.join(root, directory))
    .filter(f => f.endsWith('.json'))
    .sort()
    .flatMap(file => {
      const sourcePath = `${directory}/${file}`;
      const bytes = fs.readFileSync(path.join(root, sourcePath));
      return JSON.parse(bytes)
        .filter(record => record.metadata?.publicEvidence)
        .map(record => ({
          ...record,
          metadata: {
            sourcePath,
            sourceSha256: sha256(bytes),
            ...record.metadata,
          },
        }));
    });
}

export function loadCases() {
  return [
    ...readJson('__tests__/golden/government-services.json').cases,
    ...readJson('validation/public-service-cases.json').cases,
  ];
}

export function judgeCase(test, answer) {
  const expectedPath =
    test.expectPath ??
    (test.expectRefusal ? 'refusal' : test.expectTool ? 'unavailable' : 'record');
  const failures = [];
  if (answer.answerPath !== expectedPath)
    failures.push(`route: expected ${expectedPath}, got ${answer.answerPath}`);
  for (const phrase of test.mustInclude ?? [])
    if (!answer.answer.toLowerCase().includes(phrase.toLowerCase()))
      failures.push(`missing: ${phrase}`);
  for (const phrase of test.mustExclude ?? [])
    if (answer.answer.toLowerCase().includes(phrase.toLowerCase()))
      failures.push(`forbidden: ${phrase}`);
  if (test.expectRefusal && answer.reason !== test.expectRefusal)
    failures.push(`reason: expected ${test.expectRefusal}, got ${answer.reason}`);
  if (test.recordId && !answer.recordIds.includes(test.recordId))
    failures.push(`missing record: ${test.recordId}`);
  if (answer.modelCalled !== false) failures.push('deterministic replay called a model');
  return {passed: failures.length === 0, failures};
}

export function replay() {
  const records = loadPublicRecords();
  const policy = loadPublicPolicy();
  const session = {};
  const cases = loadCases().map(test => {
    if (test.before) answerPublicService(test.before, records, session, policy);
    const result = answerPublicService(test.query, records, session, policy);
    return {id: test.id, ...result, ...judgeCase(test, result)};
  });
  return {
    schemaVersion: 1,
    promptOrigin: 'Maintainer-authored regression criteria; not citizen conversations',
    executedAt: new Date().toISOString(),
    concurrency: 1,
    coreSha256: sha256(fs.readFileSync(path.join(root, 'src/core/publicService.ts'))),
    cases,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const command = process.argv[2];
  if (command === 'replay') {
    const report = replay();
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    if (report.cases.some(row => !row.passed)) process.exitCode = 1;
  } else if (command === 'ask') {
    process.stdout.write(
      JSON.stringify(
        answerPublicService(
          process.argv.slice(3).join(' '),
          loadPublicRecords(),
          {},
          loadPublicPolicy(),
        ),
        null,
        2,
      ) + '\n',
    );
  } else {
    process.stderr.write('Usage: node scripts/public-service.mjs replay --json | ask <question>\n');
    process.exitCode = 2;
  }
}
