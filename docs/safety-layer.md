# Airgap checks model text against approved documents

Airgap checks every question against a literal topic blocklist before search. It checks each model
answer against the retrieved documents before display. These rules catch a small set of known
errors. They do not show that an answer is correct, safe, or compliant.

## The topic blocklist runs before search

`checkBlocklist(query)` reads `config.safety.topicBlocklist` before search, tool routing, or a model
call. It returns the first whole-word match without regard to letter case.

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

A plain phrase uses the `blocked_topic` reason. A value such as
`not_medical_advice:diagnose` uses the text before the first separator as the refusal reason. Known
reasons include `blocked_topic`, `not_medical_advice`, `not_financial_advice`,
`not_legal_advice`, `low_confidence`, `ungrounded_answer`, and `state_changing_offline`.

Whole-word matching means `sue` blocks `can I sue you` but does not block `suede case`. The safety
tests cover these boundaries.

## Grounding checks run after a provider replies

`validateAnswer(text, retrievedDocs)` runs two checks before an answer reaches chat.

First, an empty retrieval returns `low_confidence`. The current `confidenceThreshold` value appears
in the audit record but does not reject a non-empty retrieval. Do not treat that setting as a
quality threshold.

Second, `checkGrounding(answer, retrievedDocs)` looks for unsourced currency amounts and dates.
Each currency-tagged number and each recognized date in the answer must appear in the retrieved
text. The amount check handles currency symbols and common currency codes. The date check handles
ISO dates, slash-form dates, and English month-and-day forms.

Set `safety.groundingRules.forbidUnsourcedAmounts` or
`safety.groundingRules.forbidUnsourcedDates` to `false` only after a domain review. These regular
expressions do not catch unsupported names, procedures, eligibility rules, or ordinary numbers.

When a check fails, the orchestrator replaces the answer with the matching refusal text. The logger
records the rejection reason and leaves out the raw rejected answer by default.

## Refusal text follows a fixed order

Airgap looks for refusal text in this order.

1. The operator value in `config.safety.refusalTemplates[reason]`
2. The locale value in `config.i18n.strings["refusal." + reason]`
3. The built-in English text in `safetyLayer.ts`

The `interpolate()` helper replaces `{{brandName}}` and `{{hotline}}` in all three sources.

```json
{
  "safety": {
    "refusalTemplates": {
      "not_medical_advice": "I can't provide medical advice, diagnosis, or treatment recommendations. For medical concerns, please consult a licensed healthcare professional or call {{hotline}} to be routed to a nurse line."
    }
  }
}
```

## Adversarial fixtures keep literal rules in sync

`__tests__/golden/adversarial.json` has 10 prompts for each of the seven industry fixtures.
Each of the 70 cases expects `refusal`, `tool`, `fallback`, or `ungrounded_answer`.
`__tests__/adversarial-coverage.test.ts` checks that every expected refusal maps to a real phrase in
that fixture's blocklist.

These cases cover known strings. They are regression tests and do not measure broad model safety.

## Operators own the remaining risks

The current layer does not detect every false statement, inspect knowledge text for prompt
injection, or check whether a backend returned correct account data. A signed bundle protects
published bytes from later changes. It does not approve the author or the content.

Before customer use, add reviewed content, domain tests, monitored refusals, signed release
records, backend authorization, escalation paths, incident handling, and provider rollback.
