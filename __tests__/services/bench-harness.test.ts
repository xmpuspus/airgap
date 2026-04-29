/**
 * Bench harness tests — assert the timing instrumentation and harness
 * behavior that produce the README device-comparison table. Mocks mirror
 * sync-service.test.ts so we exercise pure timing logic without booting
 * any native modules.
 */

jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/tmp/airgap-test',
  exists: jest.fn(async () => false),
  mkdir: jest.fn(async () => undefined),
  stat: jest.fn(async () => ({size: 0})),
  downloadFile: jest.fn(() => ({jobId: 1, promise: Promise.resolve({statusCode: 200})})),
  hash: jest.fn(async () => 'x'),
  moveFile: jest.fn(async () => undefined),
  unlink: jest.fn(async () => undefined),
}));

jest.mock('react-native-mmkv', () => {
  const store = new Map<string, string | number | boolean>();
  return {
    createMMKV: () => ({
      set: (k: string, v: string | number | boolean) => store.set(k, v),
      getString: (k: string) => (store.has(k) ? String(store.get(k)) : undefined),
      getNumber: (k: string) => (store.has(k) ? Number(store.get(k)) : undefined),
      getBoolean: (k: string) =>
        store.has(k) ? Boolean(store.get(k)) : undefined,
      remove: (k: string) => store.delete(k),
      contains: (k: string) => store.has(k),
      clearAll: () => store.clear(),
    }),
  };
});

jest.mock('../../src/services/connectivityService', () => ({
  connectivityService: {
    isOnline: jest.fn(() => false),
    addListener: jest.fn(() => () => {}),
  },
}));

// uuid 9+ ships ESM-only. The orchestrator pulls it in via offlineQueue;
// stub it so jest can require the chain without configuring babel for ESM.
jest.mock('uuid', () => ({
  v4: () => 'test-uuid-' + Math.random().toString(36).slice(2),
}));

import {demoLlmService} from '../../src/services/demoLlmService';
import {buildUserMessage} from '../../src/utils/promptBuilder';
import {runBench} from '../../src/dev/benchHarness';
import {getMode} from '../../src/services/llmRouter';
import {logger} from '../../src/services/logger';
import type {KBDocument} from '../../src/types/knowledge';

// jest.setup.ts disables the logger globally, but jest.resetModules() in one
// of the tests below loads a fresh logger instance. Re-disable on this
// suite's logger reference to keep test output clean.
logger.setEnabled(false);

const planDoc: KBDocument = {
  id: 'plan-99',
  category: 'plan',
  title: 'Super Surf 99',
  content: 'PHP 99 for 5GB data over 7 days.',
  keywords: ['plan'],
  tags: [],
};

describe('demoLlmService onFirstToken instrumentation', () => {
  it('fires onFirstToken exactly once across many tokens', async () => {
    const userMessage = buildUserMessage('plans?', [planDoc]);
    let firstTokenCount = 0;
    let totalTokens = 0;
    await demoLlmService.generate(
      'sys',
      userMessage,
      () => {
        totalTokens += 1;
      },
      () => {
        firstTokenCount += 1;
      },
    );
    expect(totalTokens).toBeGreaterThan(1);
    expect(firstTokenCount).toBe(1);
  }, 20000);

  it('does not fire onFirstToken when no onToken streaming callback is provided', async () => {
    // The harness/UI wires both together; if there's no streaming sink
    // there are no token events to anchor "first token" on. Stats still
    // record tokenCount based on the deterministic split.
    let firstTokenCount = 0;
    await demoLlmService.generate('sys', 'no reference here', undefined, () => {
      firstTokenCount += 1;
    });
    expect(firstTokenCount).toBe(0);
  });
});

describe('demoLlmService.getLastRunStats', () => {
  it('returns positive numbers after a streamed run', async () => {
    const userMessage = buildUserMessage('plans?', [planDoc]);
    await demoLlmService.generate('sys', userMessage, () => {});
    const stats = demoLlmService.getLastRunStats();
    expect(stats.loadMs).toBe(0);
    expect(stats.firstTokenMs).not.toBeNull();
    // Demo formatter is sub-millisecond on a warm host; first-token can
    // round to 0. Just assert it is recorded and not greater than total.
    expect(stats.firstTokenMs!).toBeGreaterThanOrEqual(0);
    expect(stats.totalMs).not.toBeNull();
    expect(stats.totalMs!).toBeGreaterThanOrEqual(stats.firstTokenMs!);
    expect(stats.tokenCount).not.toBeNull();
    expect(stats.tokenCount!).toBeGreaterThan(0);
  }, 20000);
});

describe('llmService.getLastRunStats before any run', () => {
  // Loaded as a fresh require to avoid any state leaked from other tests
  // in the same suite. demoLlmService is a singleton too but it gets
  // exercised first; for llmService we want the pristine state.
  beforeEach(() => {
    jest.resetModules();
  });

  it('returns nulls before load() and generate() have run', () => {
    const {llmService} = require('../../src/services/llmService');
    const stats = llmService.getLastRunStats();
    expect(stats).toEqual({
      loadMs: null,
      firstTokenMs: null,
      totalMs: null,
      tokenCount: null,
    });
  });
});

describe('runBench', () => {
  it('returns a BenchResult with one run per query and correct percentile shape', async () => {
    // Test config has llm.mode=demo, so the harness will route through
    // demoLlmService. tokensPerSec stays null (deterministic formatter).
    const queries = ['What plans do you have?', 'How do I check balance?'];
    const result = await runBench(queries);

    expect(result.runs).toHaveLength(queries.length);
    expect(result.mode).toBe(getMode());
    expect(result.device).toBeDefined();
    expect(result.model).toBeDefined();

    for (const run of result.runs) {
      expect(typeof run.query).toBe('string');
      expect(typeof run.firstTokenMs).toBe('number');
      expect(run.firstTokenMs).toBeGreaterThanOrEqual(0);
      expect(typeof run.totalMs).toBe('number');
      expect(run.totalMs).toBeGreaterThanOrEqual(0);
    }

    // Demo mode => tokensPerSec is null (deterministic, not LLM throughput)
    if (result.mode === 'demo') {
      expect(result.summary.p50TokensPerSec).toBeNull();
      expect(result.summary.p95TokensPerSec).toBeNull();
    }

    // p95 >= p50 for the firstTokenMs distribution
    expect(result.summary.p95FirstTokenMs).toBeGreaterThanOrEqual(
      result.summary.p50FirstTokenMs,
    );
  }, 30000);

  it('computes p50/p95 firstTokenMs correctly for a small query set', async () => {
    const queries = ['plans', 'balance', 'roaming'];
    const result = await runBench(queries);

    const observed = [...result.runs.map(r => r.firstTokenMs)].sort(
      (a, b) => a - b,
    );

    // p50 (median) on 3 sorted values is the middle value via linear
    // interpolation of nearest ranks (rank = 1 → value at index 1).
    expect(result.summary.p50FirstTokenMs).toBe(observed[1]);

    // p95 falls between indices 1 and 2 with frac = 0.95*2 - 1 = 0.9.
    const expectedP95 = observed[1] + (observed[2] - observed[1]) * 0.9;
    expect(result.summary.p95FirstTokenMs).toBeCloseTo(expectedP95, 6);
  }, 30000);

  it('passes onProgress for each query', async () => {
    const queries = ['plans', 'balance'];
    const seen: string[] = [];
    await runBench(queries, {
      onProgress: q => seen.push(q),
    });
    expect(seen).toEqual(queries);
  }, 30000);
});
