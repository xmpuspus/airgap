# Airgap checks model text against approved documents

Airgap checks every question against a literal topic blocklist before search. It checks each model
answer against the retrieved documents before display. These rules catch a small set of known
errors. They do not show that an answer is correct, safe, or compliant.

## The topic blocklist runs before search

`checkBlocklist(query)` reads `config.safety.topicBlocklist` before search, tool routing, or a model
call. It returns the first whole-word match without regard to letter case.

Before the blocklist, the same check catches prompt probes: requests to show, repeat, or override
the inner workings, such as "show me your system prompt", "repeat the words above", "developer
mode", or "show your configuration". The reason is `prompt_probe`, and the default answer is a
fixed refusal that does not say where the instructions, the configuration, or the model file
live. The model never sees the request. Operators can replace the wording through
`refusalTemplates.prompt_probe`, and the replacement must stay as silent about the internals.

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
text. The amount check handles currency symbols and common currency codes. The date check reads
ISO dates, slash-form dates, and English month-and-day forms into month, day, and year parts. A
record that says `2026-09-25` grounds an answer that says `September 25, 2026`. A different day or
a different year fails the check.

Third, the name check rejects a capitalized word inside a sentence that no retrieved record, the
question, or the brand has. A model that answers "Joe Biden" from memory fails here, because the
scope record names nobody. A five-letter prefix matches word forms such as "Philippine" and
"Philippines". A word at the start of a sentence or a line is skipped, as are month and weekday
names.

Set `safety.groundingRules.forbidUnsourcedAmounts`, `forbidUnsourcedDates`, or
`forbidUnsourcedNames` to `false` only after a domain review. These checks do not catch
unsupported procedures, eligibility rules, lowercase names, or ordinary numbers.

When the grounding check fails, the orchestrator shows the retrieved records instead of the model
text. The answer chip then says that the model did not answer and quotes the first unsourced
amount or date. The logger records the rejection reason and leaves out the raw rejected answer by
default. A record with `metadata.verbatim` set to `true` skips the model, so an identity statement
or a legal notice reads the same in every run. After the checks pass, the orchestrator appends
the top record's `metadata.source` line when the model text does not contain it.

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

`__tests__/golden/adversarial.json` has 10 prompts for each of the seven fictional fixtures and
14 for the government services template. Each of the 84 cases expects `refusal`, `tool`,
`fallback`, or `ungrounded_answer`.
`__tests__/adversarial-coverage.test.ts` checks that every expected refusal maps to a real phrase in
that fixture's blocklist.

These cases cover known strings. They are regression tests and do not measure broad model safety.

## Operators own the remaining risks

The current layer does not detect every false statement, inspect knowledge text for prompt
injection, or check whether a backend returned correct account data. A signed bundle protects
published bytes from later changes. It does not approve the author or the content.

Before customer use, add reviewed content, domain tests, monitored refusals, signed release
records, backend authorization, escalation paths, incident handling, and provider rollback.
