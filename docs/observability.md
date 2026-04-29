# Observability

Airgap ships three observability layers: an in-process metrics rollup
for the dev panel, a PII-redacting structured logger, and a telemetry
buffer that flushes to the BFF. This document is a tour of all three.

## In-process metrics (`src/services/metrics.ts`)

A lightweight counter set that the dev panel reads. Not persisted. All
of the following are tracked from the orchestrator's `finalizeResponse`
funnel:

- `turns` — total `processMessage` calls
- `tools` — turns resolved by the tool router
- `refusals` — turns rejected by the safety layer
- `llmGenerations` — turns that invoked a local or cloud LLM
- `searchFallbacks` — turns answered by formatted KB results alone
- `zeroHitRate` — turns with no retrieved KB docs / total
- `lowConfidenceRate` — turns with safety confidence < 0.5 / total
- `toolCallSuccessRate` — ok tool calls / all tool calls
- `llmLatencyP50Ms`, `llmLatencyP95Ms`
- `toolLatencyP50Ms`, `toolLatencyP95Ms`

The dev panel re-reads the snapshot every 2 seconds and renders the
current values plus a Reset button. Enable it by setting
`features.diagnosticsPanel: true` in `airgap.config.json`.

## Structured logger (`src/services/logger.ts`)

Every service logs through `logger.debug / info / warn / error`, which
routes to console in dev builds and to any installed listeners in prod
builds. The logger automatically redacts:

- email addresses  -> `[email]`
- PH mobile numbers (`09xxxxxxxxx`) -> `[phone]`
- International mobile numbers (`+NNNNNNN…`) -> `[phone]`
- 13–19 digit sequences that look like card numbers -> `[card]`
- Bearer / API-key-like strings -> `[token]`

Redaction runs recursively over message strings and the `data` payload
before emission. Redaction can be disabled globally via
`logger.setRedactionEnabled(false)` — the test suite does this so
assertions on log content still work.

Listeners can be added with `logger.addListener(fn)`. The return value
is an unsubscribe function. Use listeners to forward entries to a
crash-reporting SDK (Sentry, Crashlytics, etc.) without hardcoding the
integration into the logger itself.

## Telemetry buffer (`src/services/telemetry.ts`)

After every turn, the orchestrator calls `recordTurn` with a PII-safe
event:

```ts
{
  timestamp: '2026-04-09T02:31:00.000Z',
  query: '#c4e1d2f9',              // FNV-1a hash of the raw query
  kbVersion: '2026-04-05T23:09:41Z',
  retrievedDocIds: ['faq-001'],
  answerHash: '#81ae2c0b',         // FNV-1a hash of the final answer
  confidence: 0.73,
  toolCalls: ['checkBalance'],
  refusalReason: undefined,
}
```

The buffer is capped at 500 events. When the device comes online, the
flusher POSTs the buffer to `/api/v1/telemetry` in batches and removes
the events the BFF acknowledged. Failed flushes retry on the next
connectivity tick.

### What is intentionally not recorded

- Raw query text, answer text, or tool arguments
- Account numbers, balances, policy IDs, or ticket numbers
- LLM prompt text or generated tokens
- Personal identifiers of any kind

If you need richer telemetry, extend the event shape but keep the
principle of hashes-over-content. The hashes are stable within a
session so you can group "same query was asked N times" without
learning what the query was.

## Reference BFF sink

The reference BFF at `server/index.mjs` writes telemetry to
`server/telemetry.jsonl`. Production deployments should replace this
with whatever log sink you already run. The endpoint contract is:

```
POST /api/v1/telemetry
body: {"events": TelemetryEvent[]}
response: 202 {"accepted": N}
```

The BFF intentionally does not validate event schemas — malformed
events get written as-is and surface in log cleanup. Keeping the BFF
dumb makes it easy to replace with Cloud Logging or a similar fire-hose
ingestor.

## What the dev panel shows

Open Settings with `features.diagnosticsPanel: true` set. The panel
renders five sections:

- **Turns** — total, LLM, tool, refusal, search counts
- **Quality** — zero-hit rate, low-confidence rate, tool success rate
- **Latency** — LLM p50/p95, tool p50/p95
- **Safety** — whether the safety layer is enabled, blocklist size,
  confidence threshold
- **Sync** — KB version, staleness band, last sync time, last error
- **Tools registered** — count + per-tool vertical breakdown

Reset metrics with the button at the bottom. The reset is in-process
only — it does not clear the telemetry buffer or MMKV state.
