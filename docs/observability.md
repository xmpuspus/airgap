# Airgap keeps diagnostics local until an operator adds a sink

Airgap has an in-process metrics rollup, a structured logger, and a bounded telemetry buffer. The
mobile app does not include a production monitoring service.

## In-process metrics feed the development panel

`src/services/metrics.ts` counts turns, tool results, refusals, model calls, document fallbacks,
zero-hit results, low-confidence results, and tool success. It records p50 and p95 latency for
model and tool calls. The app does not persist this snapshot.

The development panel reads the snapshot every two seconds. Set
`features.diagnosticsPanel` to `true` in `airgap.config.json` to show it. The Reset button clears
only the in-process metrics. It does not clear encrypted state or the telemetry buffer.

## The logger removes a small set of text patterns

`src/services/logger.ts` sends development entries to the console and production entries to any
installed listener. Before emission, it replaces these patterns.

- Email addresses become `[email]`.
- Philippine mobile numbers that start with `09` become `[phone]`.
- International mobile-number patterns become `[phone]`.
- Sequences of 13 to 19 digits that look like card numbers become `[card]`.
- Bearer-token and API-key patterns become `[token]`.

`logger.addListener(fn)` installs a listener and returns an unsubscribe function. This is the hook
for an operator-owned crash or log service.

Pattern removal is only a safety net. It is not a privacy boundary. It can miss names, addresses, account
details, unexpected number formats, and secrets in new formats. Keep raw customer text out of log
calls.

## The telemetry buffer stores bounded turn facts

After a turn, `src/services/telemetry.ts` can store the event shown below.

```ts
{
  timestamp: '2026-04-09T02:31:00.000Z',
  query: '#c4e1d2f9',
  kbVersion: '2026-04-05T23:09:41Z',
  retrievedDocIds: ['faq-001'],
  answerHash: '#81ae2c0b',
  confidence: 0.73,
  toolCalls: ['checkBalance'],
  refusalReason: undefined,
}
```

The buffer keeps at most 500 events. When connectivity returns, the client posts batches to
`/api/v1/telemetry` and removes the events that the service accepts. A failed batch stays for the
next connectivity event.

The client leaves raw questions, raw answers, tool arguments, prompts, model output, account data,
and personal identifiers out of this event shape. The short FNV-1a hashes are stable, unkeyed, and
easy to guess for common text. They do not anonymize customer content.

Use a reviewed event schema, short retention, access rules, and a keyed or server-side grouping
method when an operator needs stronger protection.

## The reference server writes a local file

`server/index.mjs` accepts bounded event batches and appends them to `server/telemetry.jsonl`.

```text
POST /api/v1/telemetry
request body {"events": TelemetryEvent[]}
response 202 {"accepted": N}
```

This file sink supports local development. A production service must check the event schema,
reject unknown fields, limit batch size, restrict access, apply retention, and quarantine malformed
events.

## The development panel shows six groups

The panel shows turn counts, quality rates, call latency, safety settings, sync state, and registered
tools. The panel helps a developer inspect one running process. It is not durable monitoring,
alerting, customer analytics, or release evidence.
