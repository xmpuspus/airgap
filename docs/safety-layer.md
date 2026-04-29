# Safety layer

Every query goes through a topic blocklist before search. Every LLM answer
goes through a grounding check before display. This document describes
both paths, the failure modes they protect against, and how to configure
them per vertical.

## Why this exists

Gemma 4 E2B scores 24.5 on τ2-bench (Retail). Left to its own, it will
happily invent a price, make up a policy expiration, or confidently
diagnose a user's rash. None of those are acceptable in a production
support product. The safety layer is the fail-closed backstop that makes
the other 95% of correct answers trustworthy.

## Pre-flight: topic blocklist

`checkBlocklist(query)` runs before search, before tool routing, and
before any LLM call. It walks `config.safety.topicBlocklist` and returns
a `RefusalReason` on the first whole-word match.

```json
{
  "safety": {
    "topicBlocklist": [
      "not_medical_advice:diagnose",
      "not_medical_advice:prescribe",
      "not_financial_advice:should I invest",
      "not_legal_advice:sue"
    ]
  }
}
```

Syntax:

- `"phrase"` — blocks with default reason `blocked_topic`
- `"reason:phrase"` — blocks with the named reason, which picks a
  specific refusal template. Known reasons are `blocked_topic`,
  `not_medical_advice`, `not_financial_advice`, `not_legal_advice`,
  `low_confidence`, `ungrounded_answer`, `state_changing_offline`.

Matching is whole-word and case-insensitive. The pattern compiles once
per check, so blocklists with hundreds of entries are still cheap (O(n)
in blocklist size, which is fine for small lists).

The test `__tests__/safety-layer.test.ts` asserts these edge cases:

- `"sue"` blocks `"can I sue you"` but not `"suede case"`
- `"political"` does not block `"apolitical"` (word boundary)
- `"diagnose"` blocks `"diagnose me with a rash"`

## Post-flight: confidence + grounding

After the LLM (or tool router) produces an answer, `validateAnswer(text,
retrievedDocs)` gates whether that answer reaches the user.

Two checks run in order:

### Confidence check

If `retrievedDocs.length === 0`, the verdict is `low_confidence` and the
safety layer returns the refusal template for that reason (by default:
"I don't have reliable information on that. Please call {{hotline}}…").

The config exposes `safety.confidenceThreshold`, a numeric floor that
future releases will use to gate answers even when docs are retrieved.
Today the threshold only affects the confidence score reported in the
audit block; any non-empty retrieval passes.

### Grounding check

`checkGrounding(answer, retrievedDocs)` runs two regex passes:

- **Unsourced currency amounts** — any currency-tagged number in the
  answer must also appear in the retrieved corpus. So `"The plan is PHP
  299/month"` is allowed if the KB mentions `299`, but `"Pay $9999 now"`
  is rejected if `9999` is not in the retrieved docs.
- **Unsourced dates** — any `YYYY-MM-DD`, `MM/DD/YYYY`, or `Month DD`
  date in the answer must also appear in the corpus.

Both checks can be disabled per-config via
`safety.groundingRules.forbidUnsourcedAmounts` and
`forbidUnsourcedDates`. Tests cover the positive and negative cases in
`__tests__/safety-layer.test.ts`.

When either check fails, the verdict is `ungrounded_answer` and the
orchestrator swaps the answer for the configured refusal template. The
actual LLM output is logged as a `warn` so operators can see what was
rejected without losing the original text.

## Per-vertical refusal templates

Refusal copy is resolved in this order:

1. `config.safety.refusalTemplates[reason]` — operator override
2. `config.i18n.strings["refusal." + reason]` — locale-specific
3. Built-in English fallback in `safetyLayer.ts`

Every template is passed through the same `interpolate()` helper as the
rest of the config, so `{{brandName}}` and `{{hotline}}` work.

Example from the healthcare vertical config:

```json
{
  "safety": {
    "refusalTemplates": {
      "not_medical_advice": "I can't provide medical advice, diagnosis, or treatment recommendations. For medical concerns, please consult a licensed healthcare professional or call {{hotline}} to be routed to a nurse line."
    }
  }
}
```

## Adversarial fixtures

`__tests__/golden/adversarial.json` ships 10 seeded attack prompts per
vertical (70 total). Each case has an expected outcome: `refusal`, `tool`,
`fallback`, or `ungrounded_answer`. The
`__tests__/adversarial-coverage.test.ts` suite asserts that every
"refusal" case in a vertical ties to a real blocklist phrase in that
vertical's config file. Adding a new refusal expectation without adding
a matching blocklist phrase fails the test — adversarial expectations
and live policy cannot drift.

## What the safety layer does NOT do

- It does not do semantic hallucination detection. A fluent but wrong
  answer that does not mention dollar amounts or dates will pass.
- It does not protect against prompt injection in the KB content itself.
  KB authors are trusted; the sync signature check guards the bundle in
  transit.
- It does not protect against a compromised backend. If the `executeTool`
  backend returns wrong data, the safety layer only verifies that the
  LLM paraphrased it faithfully — it does not verify the data itself.

These are known gaps, not bugs. Mitigations are operational (monitor
telemetry for refusal spikes, audit KB updates, rotate BFF signing keys).
