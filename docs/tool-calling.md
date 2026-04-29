# Tool calling

Airgap's tool calling is a **deterministic keyword router** that feeds
structured backend results into the LLM as grounded context. It is
deliberately NOT a native function-calling implementation that trusts the
model to emit structured tool calls. This document explains why and how.

## Decision: keyword routing, not LLM-emitted function calls

Three factors drove the choice:

1. **Gemma 4 E2B τ2-bench (Retail) = 24.5.** Multi-step agentic reasoning
   is the benchmark on which E2B performs worst among its peers. Trusting
   the model to pick the right tool, emit syntactically valid JSON, and
   thread tool results back into a coherent answer is betting the
   reliability of the entire product on its weakest capability.
2. **llama.rn 0.12.0-rc.3 function-calling support is uncertain.** The
   llama.rn release notes do not highlight first-class structured tool
   calling for Gemma 4. Chat-template-dependent tool invocation in the
   GGUF ecosystem is a moving target. We could layer a prompt-based JSON
   parser on top, but that adds failure modes (truncated JSON,
   hallucinated tool names, malformed args) without addressing the τ2
   accuracy problem.
3. **Determinism is cheap.** Most support tool calls are triggered by
   recognizable phrases: "what is my balance", "report outage",
   "schedule callback". A keyword router costs O(tools × keywords) per
   query and never misses a well-known trigger.

The keyword router is the first stop in `processMessage`. If it matches,
the tool executes against the `BackendConnector` interface and the
structured result is passed to the LLM as a synthesized KBDocument whose
`content` is the tool's JSON output. The LLM only paraphrases; it does
not get to decide whether to call a tool, or which one.

## Anatomy of a tool definition

```json
{
  "name": "checkBalance",
  "description": "Look up the caller's account balance, data remaining, and active promo",
  "keywords": [
    "my balance",
    "my bill amount",
    "my data usage"
  ],
  "offlineQueueEligible": true,
  "stateChanging": false,
  "vertical": "telco",
  "backendMethod": "checkBalance"
}
```

- **`name`**: unique identifier used for audit logs, telemetry, and
  offline-queue routing.
- **`description`**: shown in the dev panel and in docs. Also used as
  the queued-action label when the tool is offline-queued.
- **`keywords`**: whole-word matches select this tool. Order matters —
  the first matching tool wins, so put more specific tools above more
  generic ones.
- **`offlineQueueEligible`**: if `true`, state-changing calls get
  queued when offline instead of failing. If `false`, the tool returns
  a `state_changing_offline` refusal when offline.
- **`stateChanging`**: annotates whether the tool mutates remote state.
  Purely informational today; will gate confirmation prompts in a
  future release.
- **`vertical`**: used for the dev panel grouping. Does not affect
  routing.
- **`backendMethod`**: the `BackendConnector` method to invoke. Defaults
  to `name`. See `src/services/backendConnector.ts` for the method
  catalog.

## Tool result flow

```
user query
    |
    v
findToolForQuery  -- match by keyword
    |
    v
executeTool       -- call backend or queue if offline
    |
    v
formatToolResultForLLM  -- build TOOL RESULT: block
    |
    v
buildUserMessage  -- synthesize pseudo-KBDocument
    |
    v
routeGeneration   -- local or cloud LLM paraphrases
    |
    v
validateAnswer    -- grounding check against the tool result
    |
    v
user-facing answer
```

Key points:

- The tool result is injected as a synthetic KBDocument with
  `id: "tool:${toolName}"`. The grounding check will then verify that
  any numbers or dates the LLM mentions are present in the tool result.
  If the tool returns `balance: "PHP 127.50"` and the LLM says
  `"You owe PHP 500"`, that answer is rejected.
- State-changing tools called offline go through `offlineQueue.enqueue`
  with the `tool_call` type and the tool name stashed in `toolName`.
  On reconnect, `processQueue` executes them against the real backend.
- Tool latency is recorded for the dev panel p50/p95.

## Backend method catalog

The shipped `MockBackendConnector` and `RestBackendConnector` cover the
following methods. Verticals reuse them by pointing `backendMethod` at
the right one.

| Method | Purpose | Used by |
|---|---|---|
| `checkBalance(accountId)` | Account balance lookup | telco, banking, insurance (policy status via alias) |
| `changePlan(accountId, planId)` | Plan change / add-on activation | telco |
| `createTicket(description)` | Open a support ticket / claim / dispute | telco, insurance, banking |
| `checkOutage(location?)` | Service outage lookup | telco, electric, water |
| `executeAction(type, params)` | Catch-all for tools without a dedicated method | any |

Production deployments should extend `BackendConnector` with
vertical-specific methods and map tools to them via `backendMethod`.

## Adding a new tool

1. Add the tool definition to `airgap.config.json` under `tools`.
2. If the backend method is new, add it to `BackendConnector` in
   `src/services/backendConnector.ts` and wire it in both the mock and
   REST implementations.
3. Map the tool to the backend method via `backendMethod`.
4. Add an adversarial test case to
   `__tests__/golden/adversarial.json` under the matching vertical.
5. If the tool introduces new numbers or dates in its response,
   double-check the safety layer's grounding check still passes for
   the synthesized KBDocument.

## What happens when the LLM is not loaded

If neither the local nor the cloud LLM is available (fresh install
before first model download, `llm.mode: offline-only` on a device that
hasn't downloaded the model yet, etc.) the tool router falls back to
returning the pre-formatted `result.summary` directly. Users still see a
coherent answer; they just don't get the LLM paraphrase layer.
