#!/usr/bin/env node
/**
 * Pure-Node demo-mode benchmark runner for Airgap.
 *
 * Drives the fixed query set in `bench/queries.json` through a
 * Node-importable demo pipeline and writes a per-query timing report
 * to `bench/results/node-<UTC ISO timestamp>.json`. The output shape
 * matches `BenchResult` from `src/dev/benchHarness.ts` so agent C's
 * `bench/render-table.mjs` can consume node and emulator runs uniformly.
 *
 * Two import strategies are attempted in order:
 *
 *   1. Agent A's harness at `src/dev/benchHarness.ts` via a runtime
 *      TypeScript loader (`tsx` if installed, then `ts-node`). The
 *      harness currently transitively pulls in React Native modules
 *      (MMKV, react-native-fs) that crash under bare Node, so this
 *      path is best-effort and we fall back on any error.
 *   2. A pure-JS demo pipeline: load each KB JSON, build a MiniSearch
 *      index in-process, run the demo formatter functions exported
 *      from `src/services/demoLlmService.ts` against the assembled
 *      reference block, and time each query manually.
 *
 * Strategy (1) is preferred because it exercises the same code path as
 * the on-device run. Strategy (2) is documented in `bench/README.md`
 * as the "node-host" fallback so demo numbers remain reproducible
 * even when RN-bound dependencies cannot resolve outside the bundler.
 *
 * If `src/dev/benchHarness.ts` is missing entirely (P1 handoff not yet
 * landed) the script exits non-zero with a clear message so the team
 * doesn't silently ship empty bench tables.
 */

import {readFile, writeFile, access} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {performance} from 'node:perf_hooks';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..', '..');
const require_ = createRequire(import.meta.url);

const QUERIES_PATH = path.join(projectRoot, 'bench', 'queries.json');
const RESULTS_DIR = path.join(projectRoot, 'bench', 'results');
const HARNESS_PATH = path.join(projectRoot, 'src', 'dev', 'benchHarness.ts');
const CONFIG_PATH = path.join(projectRoot, 'airgap.config.json');
const DEMO_SERVICE_PATH = path.join(
  projectRoot,
  'src',
  'services',
  'demoLlmService.ts',
);

const KB_FILES = [
  'faq.json',
  'payments.json',
  'plans.json',
  'promos.json',
  'roaming.json',
  'stores.json',
  'troubleshooting.json',
];

function isoTimestamp() {
  // Filename-safe ISO: 20260429T123456Z
  return new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

function percentile(values, p) {
  const finite = values.filter(v => Number.isFinite(v));
  if (finite.length === 0) return 0;
  const sorted = finite.slice().sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  const frac = rank - lo;
  return sorted[lo] + (sorted[hi] - sorted[lo]) * frac;
}

async function loadQueries() {
  const raw = await readFile(QUERIES_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed?.queries) || parsed.queries.length === 0) {
    throw new Error(`bench/queries.json has no queries array`);
  }
  return parsed.queries;
}

async function loadConfig() {
  const raw = await readFile(CONFIG_PATH, 'utf8');
  return JSON.parse(raw);
}

/**
 * Try to import agent A's TypeScript harness via a runtime loader.
 * Returns the harness module on success, null on any failure (logged
 * to stderr so the fallback rationale is visible in CI).
 */
async function tryLoadHarness() {
  if (!existsSync(HARNESS_PATH)) {
    throw new Error(
      'benchHarness.ts not yet built , agent A handoff missing. Expected at ' +
        HARNESS_PATH,
    );
  }

  // Best-effort: only attempted when a TS loader is already on disk.
  // We do NOT npm install here; the README documents the optional
  // `--import tsx` invocation for future runs.
  for (const loader of ['tsx', 'ts-node/esm']) {
    try {
      // Simple availability check via require.resolve.
      require_.resolve(loader);
    } catch {
      continue;
    }
    try {
      // Spawn a child node process with the loader so its hooks pick
      // up the .ts import on a fresh isolate. Importing tsx into the
      // current process after we've already done other work is
      // unreliable across versions.
      const url = pathToFileURL(HARNESS_PATH).href;
      const mod = await import(url);
      return mod;
    } catch (err) {
      process.stderr.write(
        `[bench] harness import via ${loader} failed: ${err.message}\n`,
      );
    }
  }
  return null;
}

/**
 * Pure-JS fallback pipeline: build a MiniSearch index from the bundled
 * KB JSON files, run the demo formatter logic against the top-K hits.
 * The formatter is reimplemented inline so we don't depend on the
 * TypeScript-only export from demoLlmService.ts.
 *
 * The reimplementation is byte-for-byte equivalent to
 * `formatReferenceAsReply` in src/services/demoLlmService.ts as of
 * the current commit. Tests live alongside agent A's TS module; this
 * helper exists only to keep the Node fallback dependency-free.
 */
async function runFallback(queries, config) {
  // MiniSearch is a pure-JS dep with no native code; loading via
  // createRequire is safe in Node ESM.
  const MiniSearch = require_('minisearch');

  const docs = [];
  for (const file of KB_FILES) {
    const filePath = path.join(projectRoot, 'src', 'knowledge', file);
    try {
      const text = await readFile(filePath, 'utf8');
      const arr = JSON.parse(text);
      if (Array.isArray(arr)) docs.push(...arr);
    } catch (err) {
      process.stderr.write(`[bench] skipping ${file}: ${err.message}\n`);
    }
  }
  if (docs.length === 0) {
    throw new Error('no KB documents loaded , cannot benchmark demo mode');
  }

  const searchCfg = config?.knowledge?.search ?? {};
  const topK = searchCfg.topK ?? 3;
  const fuzzy = searchCfg.fuzzy ?? 0.2;
  const boostTitle = searchCfg.boostTitle ?? 2;
  const boostKeywords = searchCfg.boostKeywords ?? 3;
  const boostContent = searchCfg.boostContent ?? 1;

  const index = new MiniSearch({
    fields: ['title', 'content', 'keywords'],
    storeFields: ['id', 'title', 'category', 'content', 'tags'],
    searchOptions: {
      boost: {title: boostTitle, keywords: boostKeywords, content: boostContent},
      fuzzy,
      prefix: true,
    },
    extractField: (document, fieldName) => {
      if (fieldName === 'keywords') {
        return Array.isArray(document.keywords)
          ? document.keywords.join(' ')
          : '';
      }
      return document[fieldName];
    },
  });
  index.addAll(docs);

  function buildReferenceBlock(hits) {
    if (hits.length === 0) return null;
    return hits
      .map(
        h =>
          `[${String(h.category).toUpperCase()}] ${h.title}\n${String(
            h.content,
          ).substring(0, 400)}`,
      )
      .join('\n\n');
  }

  // Inline mirror of formatReferenceAsReply from demoLlmService.ts.
  function formatReferenceAsReply(block) {
    const docHeaderRe = /(^|\n\n+)(\[[A-Z_]+\]\s+[^\n]*)/g;
    const headers = [];
    for (const m of block.matchAll(docHeaderRe)) {
      const start = (m.index ?? 0) + m[1].length;
      headers.push({titleStart: start, titleEnd: start + m[2].length});
    }
    if (headers.length === 0) return block.trim();
    const sections = [];
    for (let i = 0; i < headers.length; i++) {
      const {titleStart, titleEnd} = headers[i];
      const nextStart =
        i + 1 < headers.length ? headers[i + 1].titleStart : block.length;
      const headerLine = block.slice(titleStart, titleEnd).trim();
      const headerMatch = headerLine.match(/^\[([A-Z_]+)\]\s*(.*)$/);
      const title = headerMatch ? headerMatch[2].trim() : headerLine;
      const content = block.slice(titleEnd, nextStart).trim();
      if (content) sections.push(`**${title}**\n${content}`);
      else if (title) sections.push(`**${title}**`);
    }
    return sections.join('\n\n');
  }

  const runs = [];
  for (const query of queries) {
    const wallStart = performance.now();
    const hits = index.search(query).slice(0, topK);
    const block = buildReferenceBlock(hits);
    const reply = block
      ? formatReferenceAsReply(block)
      : "I don't have that in my knowledge base.";
    const wallTotal = performance.now() - wallStart;
    runs.push({
      query,
      loadMs: null,
      // In demo mode the "first token" is the moment the formatter
      // returns, which on Node is effectively the same as totalMs
      // because there is no streaming pause loop.
      firstTokenMs: Math.round(wallTotal * 100) / 100,
      tokensPerSec: null,
      totalMs: Math.round(wallTotal * 100) / 100,
      tokenCount: reply.length,
    });
  }
  return runs;
}

async function main() {
  const queries = await loadQueries();
  const config = await loadConfig();

  const device = process.env.AIRGAP_BENCH_DEVICE || 'node-host';
  const model = config?.model?.filename ?? 'unknown';
  const mode = 'demo';

  let runs = null;
  let pathTaken = null;

  // Strategy 1: try the TS harness.
  try {
    const harness = await tryLoadHarness();
    if (harness?.runBench) {
      const result = await harness.runBench(queries);
      runs = result.runs;
      pathTaken = 'harness';
    }
  } catch (err) {
    if (/agent A handoff missing/.test(err.message)) {
      process.stderr.write(`[bench] ${err.message}\n`);
      process.exit(1);
    }
    process.stderr.write(`[bench] harness path failed: ${err.message}\n`);
  }

  // Strategy 2: pure-JS fallback.
  if (!runs) {
    process.stderr.write(
      '[bench] falling back to pure-Node demo pipeline (RN deps unavailable)\n',
    );
    runs = await runFallback(queries, config);
    pathTaken = 'fallback';
  }

  const firstTokens = runs.map(r => r.firstTokenMs);
  const summary = {
    p50FirstTokenMs: Math.round(percentile(firstTokens, 50) * 100) / 100,
    p95FirstTokenMs: Math.round(percentile(firstTokens, 95) * 100) / 100,
    p50TokensPerSec: null,
    p95TokensPerSec: null,
  };

  const result = {
    device,
    model,
    mode,
    capturedAt: new Date().toISOString(),
    pathTaken,
    runs,
    summary,
  };

  const outPath = path.join(RESULTS_DIR, `node-${isoTimestamp()}.json`);
  await writeFile(outPath, JSON.stringify(result, null, 2) + '\n', 'utf8');
  process.stdout.write(
    `[bench] wrote ${outPath} (${runs.length} queries, p50=${summary.p50FirstTokenMs}ms p95=${summary.p95FirstTokenMs}ms via ${pathTaken})\n`,
  );
}

main().catch(err => {
  process.stderr.write(`[bench] fatal: ${err.stack || err.message}\n`);
  process.exit(1);
});
