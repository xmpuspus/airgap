/**
 * Benchmark harness — drives a fixed query set through the orchestrator and
 * captures per-run latency stats. Designed to be importable from a plain
 * Node script as well as from the React Native runtime, so we keep imports
 * minimal at module load time and pull in the orchestrator lazily.
 *
 * Output shape is consumed by `bench/render-bench.mjs` to produce the
 * Markdown table rendered into the README. Comparing real Gemma 4 E2B on a
 * Pixel emulator against demo mode on an iPhone simulator only makes sense
 * if the same harness drives both runs — which is the whole point of this
 * file.
 */

export interface BenchRun {
  query: string;
  loadMs: number | null;
  firstTokenMs: number;
  tokensPerSec: number | null;
  totalMs: number;
  tokenCount: number;
}

export interface BenchSummary {
  p50FirstTokenMs: number;
  p95FirstTokenMs: number;
  p50TokensPerSec: number | null;
  p95TokensPerSec: number | null;
}

export interface BenchResult {
  device: string;
  model: string;
  mode: string;
  runs: BenchRun[];
  summary: BenchSummary;
}

export interface BenchOpts {
  onProgress?: (query: string, stats: BenchRun) => void;
}

/**
 * Compute a percentile (0..100) from an unsorted numeric array. Uses
 * linear interpolation between nearest ranks. Returns NaN for empty input
 * — callers guard against that before invoking summarize().
 */
function percentile(values: number[], p: number): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  const frac = rank - lo;
  return sorted[lo] + (sorted[hi] - sorted[lo]) * frac;
}

function summarize(runs: BenchRun[], includeTps: boolean): BenchSummary {
  const firstTokens = runs.map(r => r.firstTokenMs);
  const tps = runs
    .map(r => r.tokensPerSec)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  return {
    p50FirstTokenMs: percentile(firstTokens, 50),
    p95FirstTokenMs: percentile(firstTokens, 95),
    p50TokensPerSec: includeTps && tps.length > 0 ? percentile(tps, 50) : null,
    p95TokensPerSec: includeTps && tps.length > 0 ? percentile(tps, 95) : null,
  };
}

/**
 * Run the bench. Drives each query through `processMessage` and captures
 * timing via the underlying service's `getLastRunStats()`, falling back to
 * Date.now() boundaries when stats are unavailable (e.g. the orchestrator
 * short-circuited before invoking the LLM/demo formatter).
 */
export async function runBench(
  queries: string[],
  opts: BenchOpts = {},
): Promise<BenchResult> {
  // Lazy-load to keep the module pure-Node-importable. The orchestrator
  // pulls in MMKV, react-native-fs, etc. via transitive imports, but those
  // are mocked at the jest layer and only resolved at runBench time.
  const {processMessage} = require('../services/orchestrator');
  const {getMode} = require('../services/llmRouter');
  const {llmService} = require('../services/llmService');
  const {demoLlmService} = require('../services/demoLlmService');
  const {modelConfig} = require('../config/loader');

  const mode: string = getMode();
  const isDemo = mode === 'demo';
  const device =
    (typeof process !== 'undefined' && process.env?.AIRGAP_BENCH_DEVICE) ||
    'unknown';
  const model = modelConfig?.filename ?? 'unknown';

  const runs: BenchRun[] = [];
  for (const query of queries) {
    const wallStart = Date.now();
    await processMessage(query);
    const wallTotal = Date.now() - wallStart;

    const stats = isDemo
      ? demoLlmService.getLastRunStats()
      : llmService.getLastRunStats();

    const firstTokenMs = stats.firstTokenMs ?? wallTotal;
    const totalMs = stats.totalMs ?? wallTotal;
    const tokenCount = stats.tokenCount ?? 0;
    let tokensPerSec: number | null = null;
    if (!isDemo && tokenCount > 0 && totalMs > 0) {
      tokensPerSec = (tokenCount * 1000) / totalMs;
    }

    const run: BenchRun = {
      query,
      loadMs: stats.loadMs,
      firstTokenMs,
      tokensPerSec,
      totalMs,
      tokenCount,
    };
    runs.push(run);
    opts.onProgress?.(query, run);
  }

  return {
    device,
    model,
    mode,
    runs,
    summary: summarize(runs, !isDemo),
  };
}
