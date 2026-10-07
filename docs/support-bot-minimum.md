# Eight controls make a support bot reliable before the model matters

A support bot fails in public when the system around the model is missing, not when the model is
too small. A frontier model answers fluently from memory. A small on-device model answers from the
same memory. Neither one checks a record unless the system makes it. The eight controls below are
the minimum for any customer service bot, in any industry, with any model. Every Airgap template
implements them, and [the government services case study](case-study-government-assistant-launch.md)
shows what one launch looked like without them.

## 1. Answer from records you own

Every fact in an answer comes from an approved record with a source and a checked date. The model
phrases the record. It never supplies a fact from memory. When no record covers the question, the
bot says so and gives a human route: a hotline, a page, or a ticket.

Airgap: `knowledge/` holds the records, retrieval picks them, and the answer chip counts them.
When the model drops the record's source line, the orchestrator appends it.

## 2. Put identity and scope in configuration

The bot's name, what it covers, and what it refuses are settings that the business reviews. They
are not hopes written into a prompt. A question outside the scope gets a scope answer, not a
world-knowledge answer.

Airgap: `brand.botName`, `safety.topicBlocklist`, and a scope record in the knowledge set.

## 3. Make a challenge return the same record

"Are you sure?" re-reads the record and repeats it with its source. Consistency comes from the
record store, not from the model's confidence. A bot that apologizes and changes its answer under
doubt has no record behind either answer.

Airgap: code answers a doubt check with the last record-backed answer and its sources. The model
is not asked again.

## 4. Check before display

Block listed topics before generation. Refuse weak retrieval before generation. Check every amount
and date in the answer against the record, and halt the stream when one is not there. A banner
that says the bot "may not always be accurate" is a disclaimer, not a control. When a user asks
the bot to show or override its instructions, code returns a fixed message. The model never sees
that request.

Airgap: `checkBlocklist` with its built-in prompt probe rule, `checkConfidence`, and the grounded
token gate in `safetyLayer.ts`.

## 5. Take dates, time, and locale from the system

The model has no clock and no location. Records carry an "as of" date. Time, currency, and
language answers come from code in the user's locale. A model that reports its training cutoff as
"today" has nothing else to report.

Airgap: records start with the checked date, and the locale block sets currency and region.

## 6. Keep a public replay test and run it on every change

Every known failure and every adversarial prompt is a test case. The suite runs in CI on every
change. Demos record from a committed build, and the manifest shows the provider, the model, and
the commit. A fix without a test is a claim.

Airgap: `__tests__/golden/`, `__tests__/golden/adversarial.json`, and `demo/recordings.json`.

## 7. Show the user who answered

Each answer shows the provider, the model identity, the knowledge version, and the source count.
The bot still answers from records when the device is offline, and the header says so.

Airgap: the answer chip, the source drawer, and the operating state header.

## 8. Keep the model out of decisions

The model never picks a tool, approves an action, changes a record, or spends money. Routing and
authorization are code that the business can read and test. A support bot inside an app that also
runs transactions needs this line most.

Airgap: keyword routes in `orchestrator.ts`, `backendConnector.ts` for actions, and the outbox.

## What a small model proves

Gemma 4 E2B as a 3-bit file on an emulator passes the replay prompts under these controls. The
model is the cheapest part to swap. The controls are the product.
