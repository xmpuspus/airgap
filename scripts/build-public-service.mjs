#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
import prettier from 'prettier';
import {
  root,
  loadPublicRecords,
  loadPublicPolicy,
  loadSourceArchive,
  loadCases,
  sha256,
  readJson,
} from './public-service.mjs';

const checkOnly = process.argv.includes('--check');
function emit(file, contents) {
  const target = path.join(root, file);
  if (checkOnly) {
    if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== contents)
      throw new Error(`Stale generated file: ${file}. Run npm run public:build.`);
  } else fs.writeFileSync(target, contents);
}
const coreFile = path.join(root, 'src/core/publicService.ts');
const core = fs.readFileSync(coreFile, 'utf8');
const output = ts.transpileModule(core, {
  compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022},
}).outputText;
const formatting = prettier.resolveConfig.sync(coreFile) ?? {};
emit(
  'web/public-core.js',
  prettier.format('// Generated from src/core/publicService.ts by public:build.\n' + output, {
    ...formatting,
    parser: 'babel',
  }),
);
const records = loadPublicRecords();
const historical = readJson('examples/government-services/historical-revisions.json');
const sources = Object.fromEntries(
  [...records, ...historical].map(record => {
    const file = record.metadata.sourcePath;
    return [file, loadSourceArchive(record)];
  }),
);
const experimentFile = 'evidence/public-service/experiment.json';
const pack = {
  schemaVersion: 1,
  origin:
    'Maintainer-authored prompts and criteria; factual text comes from the linked primary sources',
  coreSha256: sha256(core),
  corpusSha256: sha256(JSON.stringify(records)),
  records,
  safety: loadPublicPolicy(),
  historical,
  sources,
  cases: loadCases(),
  experiment: fs.existsSync(path.join(root, experimentFile)) ? readJson(experimentFile) : null,
};
emit(
  'web/data/public-service.json',
  prettier.format(JSON.stringify(pack), {...formatting, parser: 'json'}),
);
if (!checkOnly)
  execFileSync(process.execPath, [path.join(root, 'web/data/build.mjs')], {stdio: 'inherit'});
process.stdout.write(
  `${checkOnly ? 'Verified' : 'Built'} shared core, ${records.length} service records, ${
    historical.length
  } historical versions and ${pack.cases.length} authored cases.\n`,
);
