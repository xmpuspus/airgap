/**
 * Pure-Node measurement helpers for the Airgap bench harness.
 *
 * Each function is intentionally pure (no I/O, no globals) so the
 * orchestrating shell scripts can be tested via plain jest without any
 * React Native runtime mocks. Inputs are raw stdout strings captured
 * from `adb shell ...` calls; outputs are typed numbers.
 */

'use strict';

/**
 * Extract the TOTAL PSS (Mb) line from `adb shell dumpsys meminfo <pkg>`
 * output. Different Android releases emit slightly different formats:
 *
 *   TOTAL PSS:    412345  TOTAL RSS: ...
 *   TOTAL         412345    ...
 *   TOTAL PSS:   412,345 kB
 *
 * Always returns megabytes (PSS is reported in kB).
 *
 * @param {string} stdout dumpsys meminfo output
 * @returns {{pssMB: number}} parsed PSS in megabytes (rounded to 1 dp)
 */
function parseDumpsysMeminfo(stdout) {
  if (typeof stdout !== 'string' || stdout.length === 0) {
    return {pssMB: 0};
  }
  // Look for the TOTAL PSS line first (modern Android), fall back to
  // bare "TOTAL" + first number column. Strip thousands separators.
  const totalPssRe = /TOTAL\s*PSS\s*:?\s*([\d,]+)/i;
  const totalRe = /^\s*TOTAL\s+([\d,]+)/m;
  const match = stdout.match(totalPssRe) || stdout.match(totalRe);
  if (!match) {
    return {pssMB: 0};
  }
  const kb = Number(match[1].replace(/,/g, ''));
  if (!Number.isFinite(kb) || kb <= 0) {
    return {pssMB: 0};
  }
  return {pssMB: Math.round((kb / 1024) * 10) / 10};
}

/**
 * Scan logcat output for the first occurrence of an Airgap "first token"
 * marker. The orchestrator emits `airgap.benchHarness firstTokenMs=<n>`
 * (or `firstToken=<n>ms`) once a query begins streaming.
 *
 * Returns {firstTokenMs: null} if no marker is found so callers can
 * distinguish "not measured" from "measured as 0".
 *
 * @param {string} stdout logcat output
 * @returns {{firstTokenMs: number | null}}
 */
function parseLogcatFirstToken(stdout) {
  if (typeof stdout !== 'string' || stdout.length === 0) {
    return {firstTokenMs: null};
  }
  const patterns = [
    /firstTokenMs\s*[=:]\s*(\d+(?:\.\d+)?)/i,
    /firstToken\s*[=:]\s*(\d+(?:\.\d+)?)\s*ms/i,
    /first[_\s-]?token[^=]*=\s*(\d+(?:\.\d+)?)/i,
  ];
  for (const re of patterns) {
    const match = stdout.match(re);
    if (match) {
      const n = Number(match[1]);
      if (Number.isFinite(n) && n >= 0) {
        return {firstTokenMs: n};
      }
    }
  }
  return {firstTokenMs: null};
}

/**
 * Compute the p-th percentile of a numeric series using linear
 * interpolation between the two nearest ranks (matches numpy's default
 * behavior). p is in [0, 100].
 *
 * Returns 0 for empty input. Throws TypeError on non-array input or
 * out-of-range p so harness scripts crash loud rather than silently
 * reporting bogus values.
 *
 * @param {number[]} values
 * @param {number} p percentile in [0, 100]
 * @returns {number}
 */
function percentile(values, p) {
  if (!Array.isArray(values)) {
    throw new TypeError('percentile: values must be an array');
  }
  if (typeof p !== 'number' || p < 0 || p > 100) {
    throw new TypeError('percentile: p must be a number in [0, 100]');
  }
  if (values.length === 0) {
    return 0;
  }
  const sorted = values
    .filter(v => typeof v === 'number' && Number.isFinite(v))
    .slice()
    .sort((a, b) => a - b);
  if (sorted.length === 0) {
    return 0;
  }
  if (sorted.length === 1) {
    return sorted[0];
  }
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) {
    return sorted[lo];
  }
  const frac = rank - lo;
  return sorted[lo] + (sorted[hi] - sorted[lo]) * frac;
}

module.exports = {
  parseDumpsysMeminfo,
  parseLogcatFirstToken,
  percentile,
};
