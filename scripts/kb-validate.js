#!/usr/bin/env node
'use strict';

// kb-validate.js — checks that every JSON file in a knowledge directory
// matches the kbdoc-v1 schema (id, category, title, content, keywords[],
// tags[]) and reports stats. Logic lives in scripts/lib/kb.js so the
// kb-studio interactive flow shares the exact same validation rules.

const fs = require('fs');
const path = require('path');
const {validateDocs, summarizeKB} = require('./lib/kb');

const args = process.argv.slice(2);
let kbDir = path.resolve(__dirname, '../src/knowledge');
const dirFlagIdx = args.indexOf('--dir');
if (dirFlagIdx !== -1 && args[dirFlagIdx + 1]) {
  kbDir = path.resolve(args[dirFlagIdx + 1]);
}

function run() {
  if (!fs.existsSync(kbDir)) {
    console.error(`Directory not found: ${kbDir}`);
    process.exit(1);
  }

  const jsonFiles = fs
    .readdirSync(kbDir)
    .filter(f => f.endsWith('.json'))
    .sort();

  if (jsonFiles.length === 0) {
    console.log('No JSON files found in', kbDir);
    process.exit(0);
  }

  const allErrors = [];
  const seenIds = new Map();
  for (const filename of jsonFiles) {
    const filepath = path.join(kbDir, filename);
    let docs;
    try {
      docs = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    } catch (e) {
      allErrors.push(`${filename}: JSON parse error, ${e.message}`);
      continue;
    }
    if (!Array.isArray(docs)) {
      allErrors.push(`${filename}: expected array at root`);
      continue;
    }
    // Run validation per file but share the seenIds map across files so
    // a duplicate id between two files is still detected.
    const fileErrors = validateDocs(docs, filename);
    // validateDocs maintains its own internal seenIds; for cross-file
    // duplicate detection we pass the merged set through a second pass.
    for (let i = 0; i < docs.length; i++) {
      if (docs[i] && docs[i].id) {
        if (seenIds.has(docs[i].id)) {
          allErrors.push(
            `${filename}[${i}]: duplicate id '${docs[i].id}' (first seen in ${seenIds.get(docs[i].id)})`,
          );
        } else {
          seenIds.set(docs[i].id, filename);
        }
      }
    }
    allErrors.push(...fileErrors.filter(err => !err.includes('duplicate id')));
  }

  const summary = summarizeKB(kbDir);
  const totalKB = (summary.bytes / 1024).toFixed(0);

  console.log('KB Validation Report');
  console.log('====================');
  console.log(`Files scanned: ${summary.files}`);
  console.log(`Total entries: ${summary.totalDocs}`);
  console.log('');
  console.log('Category distribution:');
  for (const [cat, count] of Object.entries(summary.categories).sort()) {
    console.log(`  ${cat}: ${count}`);
  }
  console.log('');
  console.log(`Total size: ${totalKB} KB`);
  console.log('');

  if (allErrors.length > 0) {
    console.log('Errors:');
    for (const err of allErrors) {
      console.log(`  - ${err}`);
    }
    console.log('');
    console.log(`[FAIL] ${allErrors.length} error${allErrors.length === 1 ? '' : 's'} found`);
    process.exit(1);
  } else {
    console.log('[PASS] All entries valid');
    process.exit(0);
  }
}

run();
