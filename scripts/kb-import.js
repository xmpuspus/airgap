#!/usr/bin/env node
'use strict';

// kb-import.js — turn a CSV (id, category, title, content, keywords, tags)
// into one JSON file per category under src/knowledge/, then chain into
// kb-validate.js. Parsing logic lives in scripts/lib/kb.js so the
// kb-studio interactive flow uses the same parser.

const fs = require('fs');
const path = require('path');
const {execSync} = require('child_process');
const {csvToDocs, splitByCategory, exportToDir} = require('./lib/kb');

const csvFile = process.argv[2];
if (!csvFile) {
  console.error('Usage: node scripts/kb-import.js <data.csv> [--out <dir>]');
  process.exit(1);
}

const csvPath = path.resolve(csvFile);
if (!fs.existsSync(csvPath)) {
  console.error(`File not found: ${csvPath}`);
  process.exit(1);
}

const outFlagIdx = process.argv.indexOf('--out');
const OUT_DIR =
  outFlagIdx !== -1 && process.argv[outFlagIdx + 1]
    ? path.resolve(process.argv[outFlagIdx + 1])
    : path.resolve(__dirname, '../src/knowledge');

function run() {
  const raw = fs.readFileSync(csvPath, 'utf8');
  let docs;
  let skipped;
  try {
    ({docs, skipped} = csvToDocs(raw));
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  for (const s of skipped) {
    console.warn(`Row ${s.row}: skipping, ${s.reason}`);
  }
  if (docs.length === 0) {
    console.error('No valid entries found in CSV');
    process.exit(1);
  }
  const byCategory = splitByCategory(docs);
  const filesCreated = exportToDir(byCategory, OUT_DIR);

  console.log(
    `Imported ${docs.length} entries into ${filesCreated.length} file${filesCreated.length === 1 ? '' : 's'}:`,
  );
  for (const f of filesCreated) {
    console.log(`  ${path.relative(process.cwd(), f)}`);
  }
  console.log('');
  console.log('Running validation...');
  console.log('');

  try {
    execSync(
      `node ${path.resolve(__dirname, 'kb-validate.js')} --dir "${OUT_DIR}"`,
      {stdio: 'inherit'},
    );
  } catch {
    process.exit(1);
  }
}

run();
