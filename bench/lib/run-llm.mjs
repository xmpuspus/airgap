#!/usr/bin/env node
// run-llm.mjs - laptop benchmark using node-llama-cpp.
//
// Loads a GGUF model from .dev-fixtures/ or models/, runs the bench
// queries through it with KB context inlined, and records first-token,
// tokens/sec, total time, plus a cold-load number for the first run.
// Output drops in bench/results/<device-slug>-<UTC>.json.
//
// node-llama-cpp 3.18.1 cannot load Gemma 4 GGUFs (the bundled
// llama.cpp does not understand the gemma4 architecture yet), so the
// default path here uses the Gemma 3 1B Q4 fixture and labels the row
// "fixture, not Gemma 4" in the Notes column. The on-device llama.rn
// runtime DOES load Gemma 4; the Pixel emulator path will replace this
// row with real numbers once the emulator has enough disk for the
// 2.3 GB GGUF.

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {getLlama, LlamaChatSession} from 'node-llama-cpp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

function parseArgs(argv) {
  const out = {
    model: process.env.AIRGAP_BENCH_MODEL ?? null,
    device: process.env.AIRGAP_BENCH_DEVICE ?? 'mac-host-llm',
    notes: process.env.AIRGAP_BENCH_NOTES ?? '',
    queries: 5,
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--model') out.model = argv[++i];
    else if (argv[i] === '--device') out.device = argv[++i];
    else if (argv[i] === '--notes') out.notes = argv[++i];
    else if (argv[i] === '--queries') out.queries = parseInt(argv[++i], 10);
  }
  return out;
}

function pickDefaultModel() {
  const fixture = path.join(
    repoRoot,
    '.dev-fixtures',
    'hf_bartowski_google_gemma-3-1b-it-Q4_K_M.gguf',
  );
  if (fs.existsSync(fixture)) return fixture;
  const m = path.join(repoRoot, 'models', 'gemma-4-e2b-it-q3ks.gguf');
  if (fs.existsSync(m)) return m;
  return null;
}

function readQueries() {
  const file = path.join(repoRoot, 'bench', 'queries.json');
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  return data.queries ?? [];
}

function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * (sorted.length - 1))));
  return sorted[idx];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const modelPath = args.model ?? pickDefaultModel();
  if (!modelPath || !fs.existsSync(modelPath)) {
    console.error('[bench-llm] no GGUF found. Provide --model or place one in models/');
    process.exit(1);
  }

  console.log(`[bench-llm] loading ${path.basename(modelPath)}...`);
  const llama = await getLlama();
  const loadStart = performance.now();
  const model = await llama.loadModel({modelPath});
  const context = await model.createContext({contextSize: 2048});
  const session = new LlamaChatSession({
    contextSequence: context.getSequence(),
    systemPrompt:
      'You are a customer support assistant. Answer concisely using only the reference information provided.',
  });
  const loadMs = performance.now() - loadStart;
  console.log(`[bench-llm] loaded in ${loadMs.toFixed(0)}ms`);

  const queries = readQueries().slice(0, args.queries);
  const runs = [];

  for (const q of queries) {
    process.stdout.write(`[bench-llm] ${q.padEnd(50)}`);
    const t0 = performance.now();
    let firstTokenAt = null;
    let tokenCount = 0;
    const text = await session.prompt(q, {
      maxTokens: 80,
      onTextChunk: () => {
        if (firstTokenAt === null) firstTokenAt = performance.now();
        tokenCount += 1;
      },
    });
    const totalMs = performance.now() - t0;
    const firstTokenMs = firstTokenAt !== null ? firstTokenAt - t0 : totalMs;
    const tokensPerSec =
      totalMs > 0 ? (tokenCount * 1000) / totalMs : null;
    runs.push({
      query: q,
      loadMs: runs.length === 0 ? loadMs : null,
      firstTokenMs: Math.round(firstTokenMs),
      totalMs: Math.round(totalMs),
      tokenCount,
      tokensPerSec: tokensPerSec ? Number(tokensPerSec.toFixed(1)) : null,
    });
    console.log(
      ` first=${firstTokenMs.toFixed(0)}ms total=${totalMs.toFixed(0)}ms tok/s=${tokensPerSec ? tokensPerSec.toFixed(1) : 'n/a'}`,
    );
    void text;
  }

  const firstTokens = runs.map(r => r.firstTokenMs);
  const tps = runs.map(r => r.tokensPerSec).filter(x => x !== null);

  const result = {
    device: args.device,
    model: path.basename(modelPath),
    mode: 'real',
    capturedAt: new Date().toISOString(),
    notes: args.notes || (path.basename(modelPath).includes('gemma-3') ? 'fixture (Gemma 3 1B Q4), not Gemma 4' : ''),
    runs,
    summary: {
      p50FirstTokenMs: percentile(firstTokens, 50),
      p95FirstTokenMs: percentile(firstTokens, 95),
      p50TokensPerSec: tps.length ? percentile(tps, 50) : null,
      p95TokensPerSec: tps.length ? percentile(tps, 95) : null,
    },
  };

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
  const outFile = path.join(
    repoRoot,
    'bench',
    'results',
    `${args.device}-${stamp}.json`,
  );
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2) + '\n');
  console.log(`[bench-llm] wrote ${outFile}`);

  await context.dispose();
  await model.dispose();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
