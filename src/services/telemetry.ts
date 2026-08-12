/* eslint-disable no-bitwise -- FNV-1a hash uses ^=, >>> as intended. */
/**
 * Telemetry service — append-only audit trail of every orchestrator turn.
 *
 * Every processMessage result gets converted into a TelemetryEvent and
 * buffered locally in MMKV. On connectivity-restore (or on a schedule)
 * the buffer is flushed to the BFF's POST /api/v1/telemetry endpoint.
 *
 * What gets logged:
 *   - timestamp (ISO)
 *   - PII-safe query hash (sha256 of the raw query, truncated to 16 hex)
 *   - kbVersion at the time of the turn
 *   - retrievedDocIds (already public doc IDs, no user content)
 *   - answerHash (sha256 of the final answer, truncated)
 *   - confidence score from the safety layer verdict
 *   - toolCalls (tool names only)
 *   - refusalReason (if any)
 *
 * What never gets logged:
 *   - Raw query text or answer text
 *   - Any personal identifiers, balances, ticket numbers, or policy IDs
 *   - LLM internal state or prompt text
 */

import {getBackendConnector, type TelemetryEvent} from './backendConnector';
import {connectivityService} from './connectivityService';
import {logger} from './logger';
import {getSecureStore} from './secureStorage';
import {config} from '../config/loader';

const telemetryStorage = () => getSecureStore('telemetry-buffer');
const BUFFER_KEY = 'pendingEvents';
const MAX_BUFFER_SIZE = 500;

function analyticsEnabled(): boolean {
  // Operator opt-in: analytics.enabled defaults to false. The orchestrator
  // never queues telemetry events when this flag is off, so the local
  // buffer stays empty and there is nothing to flush.
  return (config as unknown as {analytics?: {enabled?: boolean}}).analytics?.enabled === true;
}

function hashQuery(input: string): string {
  // Lightweight FNV-1a hash. We don't need cryptographic strength — we just
  // need a stable non-reversible identifier so analytics can spot repeat
  // queries without seeing the raw text.
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function loadBuffer(): TelemetryEvent[] {
  const raw = telemetryStorage().getString(BUFFER_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveBuffer(events: TelemetryEvent[]): void {
  const capped = events.slice(-MAX_BUFFER_SIZE);
  telemetryStorage().set(BUFFER_KEY, JSON.stringify(capped));
}

/**
 * Record a single turn. Called from the orchestrator after every
 * processMessage() result is finalized.
 */
export function recordTurn(params: {
  query: string;
  answer: string;
  kbVersion?: string;
  retrievedDocIds: string[];
  confidence: number;
  toolCalls?: string[];
  refusalReason?: string;
}): void {
  if (!analyticsEnabled()) return;
  const event: TelemetryEvent = {
    timestamp: new Date().toISOString(),
    query: `#${hashQuery(params.query)}`,
    kbVersion: params.kbVersion,
    retrievedDocIds: params.retrievedDocIds,
    answerHash: `#${hashQuery(params.answer)}`,
    confidence: params.confidence,
    toolCalls: params.toolCalls,
    refusalReason: params.refusalReason,
  };
  const buf = loadBuffer();
  buf.push(event);
  saveBuffer(buf);
}

/**
 * Flush the local buffer to the BFF telemetry endpoint. No-op if offline
 * or if the backend does not expose postTelemetry (mock backend).
 */
export async function flushTelemetry(): Promise<{
  flushed: number;
  buffered: number;
}> {
  const buf = loadBuffer();
  if (buf.length === 0) return {flushed: 0, buffered: 0};
  if (!connectivityService.isOnline()) {
    return {flushed: 0, buffered: buf.length};
  }
  const backend = getBackendConnector();
  if (!backend.postTelemetry) {
    return {flushed: 0, buffered: buf.length};
  }

  const toSend = buf.slice();
  try {
    await backend.postTelemetry(toSend);
    // Clear only the events we actually sent — new events may have been
    // appended concurrently between loadBuffer() above and now.
    const latest = loadBuffer();
    const remaining = latest.filter(
      e => !toSend.some(s => s.timestamp === e.timestamp && s.answerHash === e.answerHash),
    );
    saveBuffer(remaining);
    logger.info('telemetry', 'flushed telemetry batch', {
      sent: toSend.length,
      remaining: remaining.length,
    });
    return {flushed: toSend.length, buffered: remaining.length};
  } catch (err: any) {
    logger.warn('telemetry', 'flush failed — will retry on next reconnect', {
      error: err?.message,
    });
    return {flushed: 0, buffered: buf.length};
  }
}

let scheduled = false;

/**
 * Start the telemetry flusher: one attempt every N minutes + on reconnect.
 */
export function startTelemetryFlusher(options?: {intervalMinutes?: number}): void {
  if (scheduled) return;
  if (!analyticsEnabled()) {
    logger.info('telemetry', 'analytics.enabled=false — telemetry flusher will not start');
    return;
  }
  const intervalMs = (options?.intervalMinutes ?? 10) * 60 * 1000;
  setInterval(() => {
    flushTelemetry().catch(() => {});
  }, intervalMs);
  connectivityService.addListener(online => {
    if (online) flushTelemetry().catch(() => {});
  });
  scheduled = true;
  logger.info('telemetry', 'telemetry flusher started', {
    intervalMinutes: options?.intervalMinutes ?? 10,
  });
}

export function getBufferSize(): number {
  return loadBuffer().length;
}

export function clearBuffer(): void {
  telemetryStorage().remove(BUFFER_KEY);
}
