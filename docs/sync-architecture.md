# Sync architecture

Airgap is offline-first but not offline-only. When the device is online, it
syncs its knowledge base and LLM model from an operator-controlled BFF, so
the content the bot answers from is never stale forever. This document
describes how that pipeline works end to end.

## Components

```
device                                       BFF
------                                       ---
syncService -- GET /api/v1/sync/kb -------->  manifest builder
             <-- 200 {version, sha256, sig}
             -- GET /api/v1/sync/kb/download->  bundle
             <-- 200 application/json
             -- atomic swap to bundle-current.json
             -- rebuild MiniSearch index
             -- update MMKV: kbVersion, lastSyncAt

modelManager -- GET /api/v1/sync/model ----->  model manifest
             <-- 200 {version, sha256, url, sizeBytes}
             -- (optional) download + SHA verify + atomic swap

telemetryService -- POST /api/v1/telemetry -->  audit log sink
                 <-- 202 {accepted: N}
```

## Trigger points

The sync scheduler runs in three situations:

1. On app launch — a one-shot attempt fires after the onboarding screen
   resolves. Failure is logged and the existing bundle is kept.
2. On reconnect — the connectivity service listener calls
   `syncKnowledge()` immediately when `isInternetReachable` flips from
   false to true.
3. On a foreground timer — every 6 hours by default, configurable via
   `startSyncScheduler({intervalHours: N})`.

All three paths funnel through `syncKnowledge()`, which is idempotent and
safe to call concurrently (the in-process lock is implicit — the scheduler
never stacks calls).

## Atomic swap and rollback

`syncService` never writes to `bundle-current.json` directly. The flow is:

1. Download to `bundle-<version>.json.partial`
2. SHA256 check against the manifest
3. ed25519 signature check (when a native verifier is installed)
4. Rename `bundle-current.json` -> `bundle-previous.json`
5. Rename `bundle-<version>.json.partial` -> `bundle-current.json`
6. Update MMKV: `kbVersion`, `previousKbVersion`, `lastSyncAt`

If any step after (1) fails, the partial file is deleted and the current
bundle is restored. If the rebuilt MiniSearch index fails to load (for
instance because a new KB schema breaks an existing field), the service
calls `rollbackBundle()` which restores `bundle-previous.json` -> 
`bundle-current.json` and flags `lastSyncError` in MMKV.

## Staleness banding

`getStalenessInfo()` returns a band based on the age of `lastSyncAt`:

| Band | Age since last sync |
|---|---|
| `fresh` | < 24 hours |
| `stale` | 24 hours – 7 days |
| `very_stale` | >= 7 days |
| `never` | No successful sync has ever happened on this install |

`getDegradedModePrefix()` returns a non-null string for every band except
`fresh`. The orchestrator prepends this string to every user-facing answer
that is NOT a tool call or refusal, so price and policy answers
automatically surface the caveat without the operator writing special
prompts.

## Signing keys

The reference BFF generates an ed25519 keypair on first launch and logs
the public key in base64 SPKI format. Copy that value into
`airgap.config.json`:

```json
{
  "backend": {
    "baseUrl": "https://your-bff.example.com",
    "syncPublicKey": "MCowBQYDK2VwAyEA...=="
  }
}
```

The device pins this key and refuses bundles whose signature does not
verify against it. Key rotation is a two-step process: publish new keys,
fetch new bundles under both, then remove the old key.

The current Airgap build verifies sha256 and logs the presence of a
pinned public key. ed25519 verification is a build-time hook — production
deployments must supply a native module (e.g. `react-native-quick-crypto`)
that implements `ed25519.verify(publicKey, bundle, signature)`. See
`src/services/syncService.ts:verifyBundle` for the wiring point.

## Telemetry

Every `processMessage` call produces a `TelemetryEvent`:

```ts
{
  timestamp: string,         // ISO
  query: '#' + fnv1a hash,   // PII-safe fingerprint
  kbVersion: string,
  retrievedDocIds: string[], // public KB doc IDs
  answerHash: '#' + fnv1a,   // PII-safe fingerprint
  confidence: number,        // from the safety verdict
  toolCalls: string[],       // tool names only, no args
  refusalReason: string,     // if the safety layer fail-closed
}
```

The telemetry service buffers events locally in an MMKV store with a
500-event cap. On reconnect (and every 10 minutes in the foreground) it
flushes to `POST /api/v1/telemetry`. Events that fail to flush stay in
the buffer and retry on the next cycle. The buffer never grows unbounded
— the oldest events fall off when the cap is hit.

Nothing user-identifiable is recorded: no raw query text, no answer text,
no account numbers, no session tokens. The reference BFF appends events
to `telemetry.jsonl` for inspection, but production should forward them
to whatever log sink already exists (Cloud Logging, Splunk, etc.).
