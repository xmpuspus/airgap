/**
 * Unit tests for bench/lib/measure.js helpers. Pure Node, no RN mocks.
 */

const {
  parseDumpsysMeminfo,
  parseLogcatFirstToken,
  percentile,
} = require('../../bench/lib/measure');

describe('parseDumpsysMeminfo', () => {
  test('extracts TOTAL PSS from modern dumpsys output', () => {
    const sample = `
** MEMINFO in pid 12345 [com.airgap.app] **
                   Pss  Private  Private  SwapPss      Heap     Heap     Heap
                 Total    Dirty    Clean    Dirty      Size    Alloc     Free
                ------   ------   ------   ------    ------   ------   ------
  Native Heap   123456    65432       12        0    150000   100000    50000
  TOTAL PSS:    412345  TOTAL RSS: 600000
`;
    expect(parseDumpsysMeminfo(sample).pssMB).toBeCloseTo(402.7, 1);
  });

  test('handles thousands separators in PSS value', () => {
    const sample = 'TOTAL PSS:   412,345 kB\n';
    expect(parseDumpsysMeminfo(sample).pssMB).toBeCloseTo(402.7, 1);
  });

  test('falls back to bare TOTAL line when TOTAL PSS missing', () => {
    const sample = '   TOTAL     204800     1024     2048';
    expect(parseDumpsysMeminfo(sample).pssMB).toBeCloseTo(200, 1);
  });

  test('returns 0 for empty or missing input', () => {
    expect(parseDumpsysMeminfo('').pssMB).toBe(0);
    expect(parseDumpsysMeminfo('no relevant lines here').pssMB).toBe(0);
    expect(parseDumpsysMeminfo(null).pssMB).toBe(0);
    expect(parseDumpsysMeminfo(undefined).pssMB).toBe(0);
  });

  test('returns 0 when PSS value is non-numeric', () => {
    expect(parseDumpsysMeminfo('TOTAL PSS: abcdef').pssMB).toBe(0);
  });
});

describe('parseLogcatFirstToken', () => {
  test('extracts firstTokenMs= marker', () => {
    const sample = '04-29 12:34:56 I airgap.benchHarness firstTokenMs=842 query=plans';
    expect(parseLogcatFirstToken(sample).firstTokenMs).toBe(842);
  });

  test('extracts firstToken=<n>ms variant', () => {
    const sample = 'I airgap.benchHarness: firstToken=1234ms';
    expect(parseLogcatFirstToken(sample).firstTokenMs).toBe(1234);
  });

  test('extracts decimal first-token timing', () => {
    const sample = 'firstTokenMs=512.5';
    expect(parseLogcatFirstToken(sample).firstTokenMs).toBe(512.5);
  });

  test('returns null when no marker present', () => {
    expect(parseLogcatFirstToken('').firstTokenMs).toBeNull();
    expect(parseLogcatFirstToken('unrelated logcat noise').firstTokenMs).toBeNull();
    expect(parseLogcatFirstToken(null).firstTokenMs).toBeNull();
  });

  test('returns first occurrence when multiple markers present', () => {
    const sample = 'firstTokenMs=100\nfirstTokenMs=200\nfirstTokenMs=300';
    expect(parseLogcatFirstToken(sample).firstTokenMs).toBe(100);
  });
});

describe('percentile', () => {
  test('returns 0 for empty array', () => {
    expect(percentile([], 50)).toBe(0);
    expect(percentile([], 95)).toBe(0);
  });

  test('returns single value for length-1 array', () => {
    expect(percentile([42], 50)).toBe(42);
    expect(percentile([42], 95)).toBe(42);
  });

  test('computes p50 (median) of an even-length series', () => {
    expect(percentile([1, 2, 3, 4], 50)).toBeCloseTo(2.5, 5);
  });

  test('computes p50 of an odd-length series', () => {
    expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
  });

  test('computes p95 of a 20-sample series', () => {
    const values = Array.from({length: 20}, (_, i) => i + 1);
    // Linear interp: rank = 0.95 * 19 = 18.05 -> between index 18 (=19) and 19 (=20)
    expect(percentile(values, 95)).toBeCloseTo(19.05, 2);
  });

  test('returns min for p=0 and max for p=100', () => {
    const values = [10, 20, 30, 40, 50];
    expect(percentile(values, 0)).toBe(10);
    expect(percentile(values, 100)).toBe(50);
  });

  test('ignores non-finite values in series', () => {
    expect(percentile([1, NaN, 2, Infinity, 3], 50)).toBe(2);
  });

  test('throws TypeError on non-array input', () => {
    expect(() => percentile('not an array', 50)).toThrow(TypeError);
    expect(() => percentile(null, 50)).toThrow(TypeError);
  });

  test('throws TypeError on out-of-range percentile', () => {
    expect(() => percentile([1, 2, 3], -1)).toThrow(TypeError);
    expect(() => percentile([1, 2, 3], 101)).toThrow(TypeError);
    expect(() => percentile([1, 2, 3], 'fifty')).toThrow(TypeError);
  });
});
