# Hybrid LLM design

Gemma 4 E2B is good at answering grounded knowledge-base questions and bad
at multi-turn agentic reasoning. Cloud frontier models are the opposite: good
at reasoning, bad at working when the device has no signal. Airgap treats
these as complementary failure modes and lets operators mix them via a
single config flag.

## Modes

`config.llm.mode` controls routing. Three values:

### `offline-only` (purist)

The default thesis: every answer is generated on-device. This is the mode
for air-gapped deployments, field operations, healthcare facilities with
strict data-sovereignty rules, and any environment where the device
CANNOT reach a cloud endpoint.

Tradeoffs:
- ✓ No network required, no cloud bill, no data leaves the device
- ✓ Deterministic behavior — the device is the sole source of truth
- ✗ You inherit E2B's τ2-bench (Retail) score of 24.5 for agentic tasks

### `prefer-offline` (recommended default)

On-device first. Escalate to the cloud LLM only if the local model is
not loaded OR throws an error (timeout, OOM, generation already in
progress). Use this when you want the product to feel consistent — most
queries still answer locally — but you want a real answer for the edge
cases E2B struggles with.

Tradeoffs:
- ✓ Zero cost and full data sovereignty for the 95%+ of queries that
  land on retrievable KB content
- ✓ Cloud fallback picks up the long tail without operator intervention
- ✗ Operators need to deploy a cloud LLM endpoint and pay for the tail
  queries

### `prefer-online` (cloud-first)

Cloud first. Fall back to on-device if the cloud endpoint is unreachable
or the request fails. Use this when the device is usually connected but
sometimes drops — the cloud answers when it can, local picks up when it
cannot.

Tradeoffs:
- ✓ Strongest possible answers most of the time
- ✓ Graceful degradation when the network blinks
- ✗ Every query incurs cloud cost unless cached
- ✗ Data leaves the device for most queries

## Cloud endpoint contract

The cloud LLM proxy expects a single POST endpoint:

```
POST /api/v1/llm/generate
Content-Type: application/json
Authorization: Bearer <optional>

{
  "system": "string",
  "user": "string",
  "maxTokens": 512,
  "temperature": 0.3
}

200 OK
{
  "text": "string",
  "model": "string (optional)",
  "latencyMs": number (optional)
}
```

The device does not care what model is behind the endpoint — it passes
the system+user prompt and expects a text response. Operators can run
any cloud LLM (Claude, GPT, Gemini, a self-hosted Mixtral) as long as
they put an adapter in front of it that speaks this contract.

## Caching

Responses are cached by a stable hash of `(systemPrompt, userMessage,
kbVersion)` for 30 minutes, with a 100-entry LRU cap. The cache lives
in memory only; it is cleared on app restart.

Keying the cache by `kbVersion` means that when the KB syncs to a new
version, stale cloud answers are invalidated automatically. This is
correct behavior — a fresh bundle may have new prices or policies that
the cached answer contradicts.

Disable caching by setting `config.llm.cacheByKbVersion: false`, which
swaps the kbVersion component of the key for a constant.

## Why this reframes τ2-bench

E2B at 24.5 fails ~75% of retail support scenarios **when it is the
only model in the loop**. In hybrid mode, E2B handles:

- KB retrieval paraphrasing (its strong suit — grounding-heavy)
- Tool result paraphrasing (the LLM only has to restate structured data)
- Offline scenarios (where the cloud is unreachable by definition)

And the cloud model handles:

- Multi-step agentic flows
- Novel tool selection
- Complex reasoning the KB cannot answer

The composite product hits a much better effective benchmark than E2B
alone, while preserving the offline-first thesis for users in the field
and for operators who turn the cloud path off.

## What the safety layer does in hybrid mode

The safety layer runs identically on local and cloud answers. Every
cloud response still gets grounding-checked against the retrieved KB,
still gets refusal-checked via the blocklist, and still records the
same audit metadata. Operators cannot bypass the safety layer by
routing to the cloud.

## Cost shaping

For deployments where the cloud is expensive, two levers help:

1. **`prefer-offline`** instead of `prefer-online`. Local-first means
   the cloud only pays for what the local cannot handle.
2. **Tool router shortcut.** Tools execute BEFORE either LLM runs, so
   state-changing flows (balance lookup, appointment booking) cost
   zero LLM tokens if the keyword router catches them.

Realistic expectation: a well-tuned telco deployment with a 400-entry
KB should see cloud invocation rates below 10% of turns, even in
`prefer-offline` mode, because most support queries match either a KB
entry or a registered tool.
