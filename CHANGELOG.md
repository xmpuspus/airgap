# Changelog

This file records user-visible changes to Airgap. The project follows Semantic
Versioning while it is practical, with the normal pre-1.0 allowance for breaking
minor releases.

## [Unreleased]

### Added

- Apple Foundation Models and Android ML Kit Prompt API adapters behind one provider policy.
- Provider readiness, fallback reasons, model identity, and answer provenance in onboarding,
  settings, and chat.
- Private Keychain access groups for device and simulator builds so fresh iOS installs can open
  encrypted application storage.
- A local documentation-link check that runs in CI.
- Recording metadata for provider, model, evidence class, capture command, and reviewed loops.

### Changed

- Kept demo-mode provider status on the deterministic document-answer path.
- Limited the downloaded-model engine field to the built `llama.cpp` runtime.
- Updated public setup, customization, examples, integration, recording, and contributor guidance
  to match the provider-based runtime.
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
