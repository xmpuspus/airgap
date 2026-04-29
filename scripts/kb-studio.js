#!/usr/bin/env node
'use strict';

// kb-studio.js — interactive walk-through for non-engineer operators.
// Walks: pick CSV -> validate -> preview MiniSearch top-K hits in-process
// -> export to chosen industry's knowledge dir -> chain into the journey
// runner for the same vertical. No external deps; uses the built-in
// readline so a fresh clone needs nothing beyond `npm install`.

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const {execSync} = require('child_process');
const MiniSearch = require('minisearch');

const {csvToDocs, splitByCategory, exportToDir, validateDocs} = require('./lib/kb');

const REPO_ROOT = path.resolve(__dirname, '..');
const EXAMPLES_DIR = path.join(REPO_ROOT, 'examples');

const KNOWN_VERTICALS = [
  'airline',
  'banking',
  'electric-utility',
  'healthcare',
  'insurance',
  'telco',
  'water-utility',
];

function listVerticals() {
  if (!fs.existsSync(EXAMPLES_DIR)) return KNOWN_VERTICALS;
  return fs
    .readdirSync(EXAMPLES_DIR, {withFileTypes: true})
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .filter(name => fs.existsSync(path.join(EXAMPLES_DIR, name, 'airgap.config.json')))
    .sort();
}

function makePrompt() {
  const rl = readline.createInterface({input: process.stdin, output: process.stdout});
  const ask = q =>
    new Promise(resolve => {
      rl.question(q, answer => resolve(answer.trim()));
    });
  return {
    ask,
    close: () => rl.close(),
  };
}

function previewSearch(docs, query, topK = 3) {
  const idx = new MiniSearch({
    fields: ['title', 'content', 'keywords'],
    storeFields: ['id', 'category', 'title'],
    searchOptions: {
      boost: {title: 2, keywords: 3, content: 1},
      fuzzy: 0.2,
    },
  });
  // MiniSearch dislikes id collisions across batches; use addAll once.
  idx.addAll(
    docs.map(d => ({
      id: d.id,
      category: d.category,
      title: d.title,
      content: d.content,
      keywords: (d.keywords ?? []).join(' '),
    })),
  );
  return idx.search(query).slice(0, topK);
}

function header(title) {
  console.log('');
  console.log(`== ${title} ==`);
}

async function main() {
  console.log('KB Studio Lite');
  console.log('Walks you from a CSV to a populated industry knowledge base.');
  const {ask, close} = makePrompt();

  try {
    // Step 1: CSV path
    header('1. Pick a CSV');
    const csvInput = await ask('Path to CSV (relative to repo root or absolute): ');
    if (!csvInput) {
      console.log('No CSV provided, exiting.');
      return 1;
    }
    const csvPath = path.isAbsolute(csvInput)
      ? csvInput
      : path.resolve(REPO_ROOT, csvInput);
    if (!fs.existsSync(csvPath)) {
      console.error(`Not found: ${csvPath}`);
      return 1;
    }

    let docs;
    let skipped;
    try {
      ({docs, skipped} = csvToDocs(fs.readFileSync(csvPath, 'utf8')));
    } catch (err) {
      console.error(`CSV parse failed: ${err.message}`);
      return 1;
    }
    console.log(`Parsed ${docs.length} rows; skipped ${skipped.length}.`);

    // Step 2: validate in-memory
    header('2. Validate');
    const errors = validateDocs(docs, path.basename(csvPath));
    if (errors.length > 0) {
      console.log(`Validation surfaced ${errors.length} issue(s):`);
      for (const e of errors.slice(0, 20)) console.log(`  - ${e}`);
      if (errors.length > 20) console.log(`  (+ ${errors.length - 20} more)`);
      const ok = await ask('Continue anyway? [y/N] ');
      if (!/^y/i.test(ok)) return 1;
    } else {
      console.log('All rows pass schema validation.');
    }

    // Step 3: preview MiniSearch
    header('3. Preview MiniSearch hits');
    while (true) {
      const q = await ask('Try a query (blank to skip): ');
      if (!q) break;
      const hits = previewSearch(docs, q, 3);
      if (hits.length === 0) {
        console.log('No hits.');
        continue;
      }
      for (const h of hits) {
        console.log(`  [${h.category}] ${h.title}  (score ${h.score.toFixed(2)})`);
      }
    }

    // Step 4: export
    header('4. Export to industry KB');
    const verticals = listVerticals();
    console.log('Available industries:');
    verticals.forEach((v, i) => console.log(`  ${i + 1}. ${v}`));
    console.log(`  ${verticals.length + 1}. <custom path>`);
    const choice = await ask(`Choose [1-${verticals.length + 1}]: `);
    const chosenIdx = parseInt(choice, 10) - 1;
    let outDir;
    let chosenVertical = null;
    if (chosenIdx >= 0 && chosenIdx < verticals.length) {
      chosenVertical = verticals[chosenIdx];
      outDir = path.join(EXAMPLES_DIR, chosenVertical, 'knowledge');
    } else if (chosenIdx === verticals.length) {
      const custom = await ask('Custom output directory: ');
      if (!custom) return 1;
      outDir = path.isAbsolute(custom) ? custom : path.resolve(REPO_ROOT, custom);
    } else {
      console.log('Invalid choice.');
      return 1;
    }

    const overwriteIfExists = fs.existsSync(outDir) && fs.readdirSync(outDir).length > 0;
    if (overwriteIfExists) {
      const ok = await ask(`${outDir} is not empty. Overwrite? [y/N] `);
      if (!/^y/i.test(ok)) {
        console.log('Aborted.');
        return 1;
      }
    }
    const byCategory = splitByCategory(docs);
    const files = exportToDir(byCategory, outDir);
    console.log(`Wrote ${files.length} file(s) to ${outDir}.`);

    // Step 5: optional journey run
    header('5. Run journey suite');
    const runJourneys = await ask('Run the industry journey suite? [Y/n] ');
    if (/^n/i.test(runJourneys)) {
      console.log('Skipping. Done.');
      return 0;
    }
    const runner = path.join(REPO_ROOT, '__tests__', 'run-industry-tests.mjs');
    if (!fs.existsSync(runner)) {
      console.log('No journey runner found; skipping.');
      return 0;
    }
    const env = {...process.env};
    if (chosenVertical) env.AIRGAP_INDUSTRY = chosenVertical;
    try {
      execSync(`node ${runner}`, {cwd: REPO_ROOT, stdio: 'inherit', env});
    } catch {
      console.log('Journey suite failed; review the output above.');
      return 1;
    }
    console.log('Done.');
    return 0;
  } finally {
    close();
  }
}

main()
  .then(code => process.exit(code ?? 0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
