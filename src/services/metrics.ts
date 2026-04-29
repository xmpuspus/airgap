/**
 * In-process metrics rollup. Not persisted across app restarts (dev panel
 * scope only). Call record*() from call sites that matter; the dev panel
 * reads the snapshot.
 *
 * For production telemetry, flush via the telemetry service, which hashes
 * queries and sends to the BFF.
 */

export interface MetricsSnapshot {
  turns: number;
  tools: number;
  refusals: number;
  llmGenerations: number;
  searchFallbacks: number;
  zeroHits: number;
  lowConfidence: number;
  toolCallSuccess: number;
  toolCallFailure: number;
  /** Sorted ascending. Last element is the worst. */
  llmLatenciesMs: number[];
  /** Sorted ascending. Last element is the worst. */
  toolLatenciesMs: number[];
}

const MAX_SAMPLES = 200;

function push(samples: number[], value: number): void {
  samples.push(value);
  if (samples.length > MAX_SAMPLES) samples.shift();
  samples.sort((a, b) => a - b);
}

const state: MetricsSnapshot = {
  turns: 0,
  tools: 0,
  refusals: 0,
  llmGenerations: 0,
  searchFallbacks: 0,
  zeroHits: 0,
  lowConfidence: 0,
  toolCallSuccess: 0,
  toolCallFailure: 0,
  llmLatenciesMs: [],
  toolLatenciesMs: [],
};

export function recordTurn(kind: 'llm' | 'tool' | 'search' | 'refusal' | 'system' | 'queue'): void {
  state.turns += 1;
  switch (kind) {
    case 'tool':
      state.tools += 1;
      break;
    case 'refusal':
      state.refusals += 1;
      break;
    case 'llm':
      state.llmGenerations += 1;
      break;
    case 'search':
      state.searchFallbacks += 1;
      break;
  }
}

export function recordZeroHit(): void {
  state.zeroHits += 1;
}

export function recordLowConfidence(): void {
  state.lowConfidence += 1;
}

export function recordToolCallResult(ok: boolean): void {
  if (ok) state.toolCallSuccess += 1;
  else state.toolCallFailure += 1;
}

export function recordLlmLatency(ms: number): void {
  push(state.llmLatenciesMs, ms);
}

export function recordToolLatency(ms: number): void {
  push(state.toolLatenciesMs, ms);
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo);
}

export interface MetricsReport {
  turns: number;
  tools: number;
  refusals: number;
  llmGenerations: number;
  searchFallbacks: number;
  zeroHitRate: number;
  lowConfidenceRate: number;
  toolCallSuccessRate: number;
  llmLatencyP50Ms: number | null;
  llmLatencyP95Ms: number | null;
  toolLatencyP50Ms: number | null;
  toolLatencyP95Ms: number | null;
}

export function getMetricsReport(): MetricsReport {
  const turns = Math.max(state.turns, 1);
  return {
    turns: state.turns,
    tools: state.tools,
    refusals: state.refusals,
    llmGenerations: state.llmGenerations,
    searchFallbacks: state.searchFallbacks,
    zeroHitRate: state.zeroHits / turns,
    lowConfidenceRate: state.lowConfidence / turns,
    toolCallSuccessRate:
      state.toolCallSuccess + state.toolCallFailure === 0
        ? 0
        : state.toolCallSuccess /
          (state.toolCallSuccess + state.toolCallFailure),
    llmLatencyP50Ms: percentile(state.llmLatenciesMs, 50),
    llmLatencyP95Ms: percentile(state.llmLatenciesMs, 95),
    toolLatencyP50Ms: percentile(state.toolLatenciesMs, 50),
    toolLatencyP95Ms: percentile(state.toolLatenciesMs, 95),
  };
}

export function resetMetrics(): void {
  state.turns = 0;
  state.tools = 0;
  state.refusals = 0;
  state.llmGenerations = 0;
  state.searchFallbacks = 0;
  state.zeroHits = 0;
  state.lowConfidence = 0;
  state.toolCallSuccess = 0;
  state.toolCallFailure = 0;
  state.llmLatenciesMs.length = 0;
  state.toolLatenciesMs.length = 0;
}
