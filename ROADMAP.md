# Roadmap

Airgap focuses on a dependable offline support path with explicit operator
control. A feature moves from code-complete to supported only after the named
release evidence exists.

## Current release candidate

- One provider contract now covers Apple Foundation Models, Android ML Kit
  GenAI Prompt API, downloaded `llama.rn`, authenticated cloud generation, and
  deterministic document answers.
- Provider resolution enforces mode, priority, platform, domain, locale, OS
  floor, model-download permission, and cloud permission.
- Onboarding explains ready, downloadable, downloading, and unavailable states.
- Settings shows exact provider order, readiness, OS, model identity, and policy
  status.
- Answer cards and audit records keep provider and model identity.
- Fresh Android emulator and iOS simulator footage covers the deterministic offline path through a
  cited answer without implying physical-device model evidence.
- Recording schema v2 keeps provider, model, device, OS, evidence class, capture
  command, playback speed, media facts, and loop review for all ten GIFs.
- Public docs use checked local links and separate current guidance from historical plans.
- Android and iOS native bridges compile in debug builds.
- Existing knowledge signing, encrypted storage, authenticated network access,
  deterministic actions, and encrypted outbox behavior stay in the same app.

## Release gates for platform-native providers

- Run Apple Foundation Models on at least one named eligible physical iPhone.
- Run Android Prompt API beta2 on at least one named supported physical Android
  device with a locked bootloader.
- Measure grounded answer quality, refusals, cancellation, long-context fallback,
  latency, memory, quota behavior, background handling, and model downloads.
- Repeat prompt evaluation for every supported OS and system-model identity.
- Complete Android terms, age, medical, professional-advice, metrics, and store
  disclosure review for each intended audience and industry.
- Complete one operator integration with real identity, knowledge sync, actions,
  escalation, monitoring, and rollback.
- Add automated screen-reader journeys for onboarding, provider status, answer
  provenance, outbox, and data deletion.

## Next

- Publish a documented identity-provider integration without coupling core code
  to one vendor.
- Add a durable rate-limit adapter and request audit hooks to the reference
  server.
- Add prompt-pack and knowledge-version fields to release evaluation records.
- Add a supported key-rotation window for signed knowledge bundles.
- Add config and knowledge schema migration contracts.
- Add a device matrix that can block a release when a supported model identity
  has no current evaluation.

## Later, if measured results support it

- Benchmark LiteRT-LM as another downloaded-model runtime behind the existing
  provider contract.
- Add more languages after domain reviewers approve retrieval, answer, refusal,
  and escalation fixtures.
- Add background knowledge sync only after Android and iOS lifecycle tests show
  it does not weaken the offline boundary.
- Add pluggable durable queue storage for larger operator workloads.
- Evaluate Apple Core AI custom model providers without changing the action or
  authorization boundary.

## Not planned as core features

- A hosted control plane or hosted customer-data service.
- Embedded production credentials or a generic password login screen.
- Sensitive account actions that a model chooses or approves.
- Claims of HIPAA, GDPR, FedRAMP, financial, medical, or legal compliance.
- Browser and desktop ports that weaken the mobile offline boundary.
- A general-purpose agent framework or inference benchmark product.

Open a [feature request](https://github.com/xmpuspus/airgap/issues/new?template=feature_request.md)
with the user problem, operating mode, security effect, and test approach.
