# Airgap product readiness review

Checked against `main` on 2026-08-13. This page replaces the April 2026 proof-of-concept scorecard,
which no longer described the repository. Git history keeps that earlier audit.

## The project is useful for offline support pilots

Airgap now gives maintainers a checked React Native base for local FAQs, troubleshooting, policy lookup,
locations, eligibility guidance, and recoverable service requests. The default demo works without
a model file or network request. Seven fictional industry fixtures exercise the same runtime with
different knowledge, prompts, tools, and safety rules.

The repository includes the following parts.

- local MiniSearch retrieval with visible document citations
- deterministic document answers for a no-download first run
- Apple, Android, downloaded-model, cloud, and demo provider contracts
- operator rules for provider order, platform, domain, locale, OS, downloads, and cloud use
- separate encrypted stores for conversations, outbox, preferences, and telemetry
- signed knowledge updates, authenticated network calls, and an idempotent outbox
- a packaged `create-airgap-bot` command with seven templates
- Android and iOS build checks, journey tests, recording validation, and local link checks.

## Readiness depends on the use case

| Use case                                     | Repository state                       | Work an operator still owns                           |
| -------------------------------------------- | -------------------------------------- | ----------------------------------------------------- |
| Offline FAQs and troubleshooting             | Ready for evaluation and bounded POC   | Replace and approve knowledge and test target devices |
| Locations, hours, plans, and policy guidance | Ready for evaluation and bounded POC   | Content ownership, expiry, escalation, accessibility  |
| Account lookups and service requests         | Interface and queue contracts exist    | Identity, authorization, backend adapter, audit       |
| Apple Foundation Models answers              | Bridge and controlled app journey pass | Eligible physical-device evaluation                   |
| Android ML Kit Prompt API answers            | Bridge and controlled app journey pass | Listed physical-device evaluation and terms review    |
| Downloaded GGUF answers                      | Runtime and integrity checks exist     | Model license, hosting, device matrix, prompt tests   |
| Regulated or safety-sensitive customer use   | No compliance claim                    | Legal, privacy, security, clinical, and policy review |
| Production operations                        | Reference contracts exist              | Monitoring, support, release, rollback, and recovery  |

## Evidence that exists

- Jest covers provider policy, storage, sync, safety, tools, UI state, package installation, and
  recording facts.
- Journey runners check 100 single-turn cases, 100 conversations, and 66 industry cases.
- CI builds Android and iOS debug targets and checks direct dependency advisories.
- One manifest supplies 13 debug-only Apple and Android provider scenarios. Swift and Kotlin parse
  it directly, and Maestro runs available or failure paths through the native bridge and visible UI.
- The evidence validator distinguishes deterministic runtime, simulated provider, host-native
  model, and target-device reports. Capture hardware remains a separate field.
- The macOS Foundation Models probe loads the real framework. The 2026-08-13 maintainer run found
  Apple Intelligence disabled, which is an environment observation and not a passing model run.
- Every kept GIF records the source commit, device, OS, provider, model identity, capture command,
  duration, dimensions, byte size, public playback speed, evidence class, and loop review.

See [`README.md`](README.md) for the current evidence table and
[`demo/recordings.json`](demo/recordings.json) for exact media facts.
Use [`docs/provider-validation.md`](docs/provider-validation.md) for the exact provider commands and
the limits of each evidence class.

## Release gaps

These items block a claim that platform-native providers or a customer deployment are production
ready.

1. Run Apple Foundation Models on a named eligible iPhone and record the model and OS build.
2. Run Android Prompt API on a named supported device with a locked bootloader.
3. Repeat grounded-answer, refusal, quota, background, cancellation, heat, memory, and latency
   tests for every supported system-model version.
4. Connect one operator identity provider, signed knowledge source, action service, escalation
   route, and monitoring system.
5. Add automated screen-reader journeys and complete manual accessibility checks.
6. Publish a tagged release only after the remote tag, package archive, and release notes match the
   checked commit.

## The project boundary is deliberate

Airgap is not a hosted customer service, identity provider, account system, compliance certificate,
or general agent framework. Models phrase retrieved information. They do not choose tools,
authenticate a person, approve sensitive actions, or update an account.

Use [`ROADMAP.md`](ROADMAP.md) for planned work, [`DEPLOYMENT.md`](DEPLOYMENT.md) for an operator
checklist, and [`SECURITY.md`](SECURITY.md) for the security boundary.
