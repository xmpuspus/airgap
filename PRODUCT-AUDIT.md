# Airgap Product Audit

Date: 2026-04-05 (original) / 2026-04-09 (update)
Project: Airgap -- Offline-resilient, sync-capable customer support framework
Stack: React Native 0.84 + Gemma 4 E2B (llama.rn) + MiniSearch + reference BFF
Stage: PoC, hardening pass complete

---

## Update — 2026-04-09 hardening pass

The 9 ship blockers below were addressed across two ultrawork sessions
on 2026-04-09. Status of each:

| # | Blocker | Status | Resolution |
|---|---------|--------|------------|
| 1 | use_mlock will OOM | [DONE] | llmService disables mlock by default; small-device path |
| 2 | No LLM generation timeout | [DONE] | 15s timeout via context.stopCompletion |
| 3 | LLM race condition | [DONE] | Mutex around llmService.generate |
| 4 | DownloadProgress is a stub | [DONE] | Wired to modelManager streaming progress |
| 5 | connectivityService.init never called | [DONE] | Init at module load, App.tsx destroys on unmount |
| 6 | No model integrity check | [DONE] | SHA256 verified before promoting partial to final |
| 7 | Observability score 8/100 | [DONE] | Logger + metrics + telemetry pipeline + dev panel |
| 8 | White-label score 18/100 | [DONE] | airgap.config.json drives brand/theme/prompts/tools/safety/i18n |
| 9 | KB sync was a no-op | [DONE] | knowledge/index.ts now reads bundle-current.json on boot, syncService rebuilds MiniSearch on swap with rollback to previous bundle on parse failure |

New scope landed in this pass:

- KB sync pipeline with reference BFF, signed manifests, atomic swap, rollback (`docs/sync-architecture.md`)
- Tool router with 7 vertical example configs, 28 keyword tests, 70+ NL phrase coverage tests (`docs/tool-calling.md`)
- Safety layer with topic blocklist, BM25-based confidence gate, currency/date grounding enforcement (`docs/safety-layer.md`)
- Hybrid LLM router (`offline-only | prefer-offline | prefer-online`) with cloud LLM proxy and per-user MMKV override (`docs/hybrid-llm-design.md`)
- Per-vertical golden eval sets (`__tests__/golden/*.json`)
- Settings: Sync section, AI Mode segmented control, 7-tap diagnostics
- StalenessChip in chat header (verified on Android emulator)
- Refusal and tool source rendering in MessageBubble
- Onboarding capability bullets and English-only KB notice
- analytics.enabled flag actually gates the telemetry flusher
- Wi-Fi-gated model update polling via modelManager.checkForUpdate
- CI lint + typecheck + jest + Android assemble + iOS xcodebuild
- Test count: 54 -> 110 (110 jest tests + 100 search journeys + 199 multi-turn turns + 66 industry tests)

Outstanding follow-ups (documented, not yet wired):

- ed25519 signature verification on KB bundles is sha256-only until a native verifier is linked (see `docs/sync-architecture.md`)
- Encryption key derivation falls back to install-UUID until `installSecretStoreProvider()` is called with a Keystore/Keychain adapter at app boot

---

## SCORES

```
  UX:              42/100   [Needs work]
  Intelligence:    55/100   [Needs work]
  Reliability:     52/100   [Needs work]
  Performance:     58/100   [Needs work]
  Observability:    8/100   [Critical]
  Security:        72/100   [Adequate]
  Operational:     38/100   [Critical]
  Feature Gaps:    35/100   [Critical]
  White-Label:     18/100   [Critical]
  ---
  Overall:         43/100   (weighted: reliability/security 1.5x, features 0.75x)
```

---

## SHIP BLOCKERS (must fix)

1. [Critical] **use_mlock: true will OOM on target device** -- llmService.ts:33 pins 2.5GB in physical RAM on a device with 2GB available. Change to `use_mlock: false`.

2. [Critical] **No LLM generation timeout** -- llmService.ts:58-78 has no timeout. On slow devices, generation can hang 30+ seconds with no UI feedback. Add 15-second timeout with `context.stopCompletion()`.

3. [Critical] **LLM race condition on rapid sends** -- orchestrator.ts has no concurrency guard. If user sends 3 messages fast, 3 concurrent LLM generations compete for the same context. Add a mutex or queue.

4. [Critical] **DownloadProgress is a stub** -- DownloadProgress.tsx uses simulated progress, not the real modelManager. Onboarding completes with no actual model downloaded.

5. [Critical] **connectivityService.init() never called reliably** -- If NetInfo listener isn't set up, the offline queue is dead code. The init in App.tsx may race with first render.

6. [Critical] **No model integrity check** -- modelManager.ts downloads 2.5GB with no SHA256 verification. A corrupted or tampered model silently loads.

7. [Critical] **Zero observability** -- Exactly one `console.warn` in the entire codebase. No logging, no metrics, no crash reporting. Impossible to debug on device.

---

## HIGH IMPACT (should fix soon)

8. [High] **No download resume** -- 2.5GB download on PH mobile data with no Range header resume. Network drop = restart from zero.

9. [High] **Greeting detector false positives** -- isGreeting treats "SIM", "APN", "BGC" as greetings (3 alphabetic chars). These are legitimate queries.

10. [High] **Follow-up detector false positive bias** -- Any 1-3 word query with history is auto-classified as follow-up. "APN settings" after a payment conversation gets payment-polluted results.

11. [High] **No negation understanding** -- "I don't want postpaid" returns postpaid docs because MiniSearch matches keywords regardless of negation.

12. [High] **Conversation history is ephemeral** -- Module-level variable, no MMKV persistence. App backgrounding or screen navigation loses all history.

13. [High] **Missing online actions** -- "cancel my plan", "disconnect my line", "deactivate account" not detected as online-required.

14. [High] **System prompt lacks comparison instructions** -- When 3 docs are in context, the 1B model needs explicit guidance to compare features.

15. [High] **No live agent escalation path** -- Table-stakes for CS bots. No way to hand off to a human.

16. [High] **No CI/CD pipeline** -- No GitHub Actions, no build verification, no automated testing.

17. [High] **Unpinned dependencies** -- package-lock.json exists but deps use `^` ranges. llama.rn may be a release candidate.

18. [High] **MODEL_SIZE_MB config says 500 but model is 2.5GB** -- config.ts:6 is wrong, affects download UX.

---

## IMPROVEMENTS (medium priority)

19. [Medium] **No streaming tokens to UI** -- llmService supports streaming via onToken, but ChatScreen doesn't use it. Users see nothing for 2-5 seconds.

20. [Medium] **Context window tight** -- 2048 tokens with 3 docs + 3 history turns. Should be 4096 (Gemma 4 E2B supports 8192).

21. [Medium] **No search result re-ranking** -- "cheapest plan" may not surface the actual cheapest. Add price/speed-aware sorting.

22. [Medium] **Query expansion ignores bot response** -- "the cheapest one" after bot lists plans doesn't reference plan names from the response.

23. [Medium] **Content truncation at 400 chars** -- Troubleshooting docs are 2000+ chars but only first 400 sent to LLM. Loses critical later steps.

24. [Medium] **No user feedback mechanism** -- No thumbs up/down, no "was this helpful?", no way to track answer quality.

25. [Medium] **No conversation persistence** -- Chat history lost on app restart.

26. [Medium] **MMKV not encrypted** -- Stores user queries and queue data unencrypted.

27. [Medium] **No accessibility labels** -- No `accessibilityLabel` on any interactive element.

28. [Medium] **No dark mode** -- Only light theme.

---

## CROSS-CUTTING THEMES

**Theme 1: Integration gaps between components.** Individual services are well-built (orchestrator, search, LLM, download) but they're not properly wired together. DownloadProgress is a stub. SettingsScreen has local state disconnected from modelManager. Streaming exists but isn't connected to the UI. The architecture is solid -- the plumbing is incomplete.

**Theme 2: PoC vs production gap.** The intelligence layer is surprisingly strong (200 test cases, follow-up detection, query expansion, proper prompt engineering) but operational infrastructure is nearly absent (no logging, no CI, no monitoring, no error reporting). This is a PoC that invested deeply in the AI pipeline and underinvested in everything around it.

**Theme 3: White-label potential is real but far.** Clean service separation and typed KB schema make the architecture suitable for platformization, but 17 hardcoded brand references, static KB imports, and no backend abstraction mean the gap is entirely in configuration/abstraction layers.

---

## TOP 5 ACTIONS (ordered by impact/effort)

1. **Fix `use_mlock: false` + add generation timeout + add concurrency guard** -- Fixes 3 critical findings (ship blockers 1-3). Effort: S (3 lines of code).

2. **Wire real model download to onboarding + settings** -- Fixes 2 critical + 1 high findings. Connect DownloadProgress to modelManager.downloadModel(). Show real model status in SettingsScreen. Effort: M (rewire existing code, not new features).

3. **Add basic logging + performance capture** -- Fixes the 8/100 observability score. Create a simple logger service, capture LLM timing/token data (already returned by llama.rn), log search scores. Effort: M.

4. **Fix greeting/follow-up false positives** -- Fixes 2 high findings. Exempt known acronyms from greeting check. Add topic-keyword detection before the blanket short-query follow-up rule. Effort: S.

5. **Create brand.config.ts + BackendConnector interface** -- First step toward white-label. Extract 17 hardcoded references to a config file. Define the backend integration interface. Effort: M-L (mostly mechanical extraction).

---

## WHITE-LABEL ROADMAP

### What Makes This Viable as a Platform

The core differentiator -- **offline-first + on-device LLM** -- is a genuine moat. No Freshchat, Zendesk, Intercom, or Ada works without internet. Enterprise verticals that need this: field service (oil/gas, utilities, mining), military, disaster response, rural healthcare, transportation crews, factory floor workers.

### Architecture Gaps for White-Label

| Layer | Current | Needed |
|-------|---------|--------|
| Brand | 17 hardcoded refs | `brand.config.ts` consumed everywhere |
| KB content | Static JSON imports | Remote sync + local cache + hot-reload |
| KB management | Edit JSON files | Admin CMS or import tool (CSV/JSON/API) |
| Backend | Hardcoded mocks | `BackendConnector` interface + REST/GraphQL adapter |
| Actions | 4 telco types | Configurable action registry |
| System prompt | Hardcoded string | Templated with brand + capability variables |
| Model | Gemma 4 E2B hardcoded | Model selector (size vs device capability) |
| Theme | Hardcoded colors | Theme from brand config |
| Deployment | Manual build | CLI scaffolder: `npx create-airgap --brand acme.json` |
| Analytics | None | Event tracking with configurable sink (Mixpanel/Amplitude/custom) |

### Suggested White-Label Config Format

```json
{
  "brand": {
    "name": "AcmeCorp",
    "botName": "AcmeBot",
    "hotline": "1-800-ACME",
    "colors": { "primary": "#1E40AF", "secondary": "#F97316" },
    "logo": "assets/acme-logo.png"
  },
  "knowledge": {
    "bundlePath": "kb/acme-kb.json",
    "remoteSyncUrl": "https://api.acme.com/kb/latest",
    "syncIntervalHours": 24
  },
  "backend": {
    "type": "rest",
    "baseUrl": "https://api.acme.com/v1",
    "endpoints": {
      "balance": "/customer/{id}/balance",
      "createTicket": "/tickets",
      "outageStatus": "/network/outages"
    },
    "auth": { "type": "bearer", "tokenEndpoint": "/auth/token" }
  },
  "model": {
    "name": "gemma-4-e2b",
    "url": "https://models.acme.com/gemma-4-e2b-q3.gguf",
    "sha256": "abc123...",
    "contextSize": 4096
  },
  "features": {
    "offlineQueue": true,
    "liveAgentEscalation": true,
    "analytics": { "provider": "mixpanel", "token": "..." }
  }
}
```

### Implementation Priority for White-Label

1. **brand.config.ts** -- Extract all hardcoded strings. Effort: 1 day.
2. **BackendConnector interface** -- Abstract mock backend. Effort: 1 day.
3. **Remote KB sync** -- Download updated KB JSON from URL. Effort: 2 days.
4. **Model config** -- URL, checksum, context size from config. Effort: 0.5 days.
5. **CLI scaffolder** -- `npx create-botkit --config brand.json`. Effort: 3 days.
6. **Admin CMS** -- Web dashboard for KB management. Effort: 2 weeks.

Full reports: `/tmp/product-audit-{dimension}.md`
