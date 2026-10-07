# Changelog

This file records user-visible changes to Airgap. The project follows Semantic
Versioning while it is practical, with the normal pre-1.0 allowance for breaking
minor releases.

## [Unreleased]

### Added

- A `government-services` template with dated, sourced public records for Philippine officials,
  holidays, hotlines, and service steps, plus golden and adversarial cases that replay the
  2026-09-21 eGovPH assistant failures. Two recordings replay six and ten prompts with Gemma 4
  E2B on an Android emulator.
- A comparison GIF builder that puts one card per prompt, with crops of the published
  screenshots or a note on what the beat proves, next to the recorded take, with a `showcase`
  recording kind and a `virtual-device-model` provider evidence class. A second composed GIF
  shows five service prompts: a fee, a requirements list, a holiday date, a hotline, and a report
  queued in airplane mode.
- A built-in reply for a queued action when the template defines no `prompts.queued` text.
- A model recording path in the industry runner: `--llm-mode`, `--provider`, `--model-file`, and
  `--platform ios`, with a streamed model copy into the app directory.
- `model.recordChars` and `model.generationTimeoutMs` in the configuration contract.
- A built-in prompt probe guardrail: a request to show, repeat, or override the instructions,
  the configuration, the tools, or the model file gets a fixed refusal before any model runs. The
  refusal does not say where any of it lives.
- Date and time answers from the device clock as system messages.
- A doubt check such as "sigurado ka dyan?" repeats the last record-backed answer from the record
  store, with the same sources.
- A short question that equals a record keyword searches on its own instead of as a follow-up.
- The answer chip says why the model did not answer when the app shows records instead.
- A `docs/support-bot-minimum.md` page with the nine controls any support bot needs, and a case
  study that maps one public launch to them.
- A streaming gate that holds model text until the grounding check passes, so an unsourced
  amount or date never reaches the screen.
- `metadata.verbatim` on a knowledge record, which answers as written with no model phrasing.
- A source line from `metadata.source` on every model answer that does not already carry it.
- A name check in the grounding rules: a capitalized word that the retrieved records, the
  question, and the brand do not contain fails the answer, and the records show instead.
- Publisher, source URL, checked date, and review status in the source drawer when a record
  carries that metadata.
- A test that validates every example configuration at startup rules.
- Apple Foundation Models and Android ML Kit Prompt API adapters behind one provider policy.
- Provider readiness, fallback reasons, model identity, and answer provenance in onboarding,
  settings, and chat.
- Private Keychain access groups for device and simulator builds so fresh iOS installs can open
  encrypted application storage.
- A local documentation-link check that runs in CI.
- Recording metadata for provider, model, evidence class, capture command, and reviewed loops.
- A reproducible GIF rebuild command with bounded public playback speed.

### Changed

- Kept demo-mode provider status on the deterministic document-answer path.
- Matched the model checksum and size to the current upstream Gemma 4 E2B file.
- Turned off the Gemma 4 thinking channel, which streamed reasoning into the answer.
- Accepted a sourced date in either word order in the grounding check.
- Matched a prose date in an answer to an ISO date in the record, so `September 25, 2026` passes
  against `2026-09-25`.
- Told the model not to repeat the "reference information" wording in its answer.
- Showed the retrieved records instead of a refusal when model text fails the grounding check.
  The answer chip says that the model did not answer and quotes the unsourced value.
- Showed whole records on the no-model path. The 200-character cut dropped every source line.
- Fixed the refusal bubble, which collapsed its text to a tall empty bar.
- Ran the Apple on-device model with content-transformation guardrails, because the iOS Simulator
  cannot load the sensitive-content classifier that the default guardrails need.
- Limited the downloaded-model engine field to the built `llama.cpp` runtime.
- Updated public setup, customization, examples, integration, recording, and contributor guidance
  to match the provider-based runtime.
- Rerecorded the Android, iOS, joint, and seven industry flows, all at one checked source commit.
- Prepared version 0.2.0 across the mobile apps, root workspace, and `create-airgap-bot` package.

## [0.2.0] release candidate

### Added

- Platform-protected random keys for separate encrypted user-data stores.
- An installed access-token provider for REST, sync, model manifest, and cloud
  requests.
- Exact length, SHA-256, key ID, Ed25519 signature, and schema checks for
  downloaded knowledge bundles.
- Queue receipts, failed states, Retry and Remove controls, and idempotency keys.
- One encrypted conversation snapshot for visible messages and model context.
- Complete in-app deletion across conversation, queue, telemetry, knowledge,
  model, preferences, and onboarding data.
- Demo, Local, Cloud, and Offline state labels, answer source details, an outbox,
  and reduced-motion handling.
- An allowlisted, version-matched app template inside the CLI tarball.
- CI jobs for Android and iOS builds, dependency review, CodeQL, Scorecard,
  packed CLI installation, direct advisory handling, and recording validation.
- Project support, governance, conduct, roadmap, and private security reporting
  files.

### Changed

- Reworked onboarding, conversation, settings, README, and project site around
  checked behavior and explicit operator responsibilities.
- Aligned the app palette to deep navy, cyan actions, orange attention, and
  neutral content surfaces.
- Updated safe direct dependencies and removed the CLI archive download path.
- Made the reference server importable for request tests and added bounded body
  and rate-limit behavior.

### Removed

- Stored bearer values, OAuth client secrets, unsupported GraphQL configuration,
  mutable branch downloads, and the unused attachment control.
- Compliance, physical-device performance, and privacy claims that repository
  checks cannot support.

Compare the [unreleased changes](https://github.com/xmpuspus/airgap/compare/v0.2.0...HEAD)
or read the [0.2.0 release page](https://github.com/xmpuspus/airgap/releases/tag/v0.2.0)
after publication.
