# Airgap provider validation without owned mobile hardware

Written 2026-08-13

## The test system separates repeatable behavior from hardware facts

Airgap needs repeatable proof that its Apple Foundation Models and Android ML Kit Prompt API
providers behave correctly when a system model is ready, downloading, unavailable, interrupted,
rate limited, or blocked in the background. Most of those application behaviors can run on the
iOS Simulator and Android Emulator. A smaller set of facts, including device eligibility, system
model installation, battery use, heat, and hardware-specific performance, still needs target
hardware.

So the validation system will produce four provider evidence classes.

1. `deterministic-runtime` proves the real document formatter path without model output.
2. `simulated-provider` proves application routing, user interface, native bridge events, error
   handling, cancellation, downloads, fallback, provenance, and audit records with controlled
   scenarios.
3. `host-native-model` proves prompts and generation against a real platform model running on a
   compatible host. The first implementation runs Apple's Foundation Models framework on macOS.
4. `target-device` proves the exact provider, model, operating-system build, and runtime behavior on
   a physical device. The device may be locally attached or hosted by a remote device lab.

Every report and recording must carry one of these values. The recording manifest keeps its
existing `evidenceClass` field for capture hardware and adds `providerEvidenceClass` for provider
proof. Simulated and host-model results must never be described as physical iPhone or Android
evidence.

## A hybrid harness gives the strongest evidence without buying phones

Three approaches were considered.

### Use only JavaScript mocks

This is inexpensive and the repository already tests provider adapters this way. It does not run
the application on a simulator, cross the React Native bridge, exercise lifecycle changes, or
produce recordings of complete user journeys. It remains the fastest unit-test layer but is not
enough by itself.

### Run only local substitute models

A downloaded model can create realistic streaming and memory pressure on an emulator. It cannot
reproduce Apple or Google availability states, model downloads, quota codes, or system-service
behavior. It is useful as an optional load source, not as a replacement for controlled scenarios.

### Combine controlled scenarios, host models, and a narrow device gate

This is the selected approach. Debug builds expose controlled native-provider scenarios to the
existing Apple and Android provider adapters. A macOS runner uses the real Apple system model for
prompt evaluation. Optional downloaded-model runs exercise kept local generation. Only the
remaining hardware facts are sent to a locally attached phone or remote physical-device service.

This approach keeps everyday development deterministic while preserving honest release evidence.

## Debug-only scenarios run through the existing provider contracts

The simulator harness will use the existing `AppleFoundationModelsModule` and
`AndroidAicoreModule` names. The production TypeScript providers and resolver will not gain a
second code path.

Each native module will check for a test scenario only in a debug build.

- iOS reads the `-AirgapProviderScenario <name>` launch argument.
- Android reads the `airgapProviderScenario` activity intent extra.
- Release builds ignore both values and contain no selectable simulated provider behavior.
- An unset or unknown scenario leaves the current production behavior unchanged in a debug build.

A small platform-local harness object owns scenario parsing, capabilities, streaming events,
download events, delays, cancellation state, and normalized errors. The production model calls
stay in the existing module and execute when no scenario is active.

The first scenario set is deliberately small and maps to real provider states Airgap already
understands.

| Scenario              | Capability or generation behavior                          |
| --------------------- | ---------------------------------------------------------- |
| `available`           | Streams a grounded cited answer and returns model identity |
| `downloadable`        | Reports that a system model can be downloaded              |
| `downloading`         | Emits bounded download progress before becoming ready      |
| `device-not-eligible` | Reports unsupported target hardware                        |
| `provider-disabled`   | Reports disabled platform intelligence                     |
| `model-not-ready`     | Reports incomplete setup or model initialization           |
| `unsupported-locale`  | Rejects before generation                                  |
| `busy`                | Rejects with the shared busy reason                        |
| `quota-exceeded`      | Rejects with the shared quota reason                       |
| `background-blocked`  | Rejects when generation is attempted in the background     |
| `context-exceeded`    | Rejects an oversized grounded request                      |
| `cancelled`           | Starts streaming and then confirms request cancellation    |
| `generation-failed`   | Produces a normalized terminal provider failure            |

Platform-inapplicable scenarios are omitted from that platform's test matrix. For example, Apple
does not expose the Android model-download contract, and Android does not report Apple
Intelligence settings.

The harness answer is fixed and visibly marked as simulated in its model identity. Its text uses
the same citation shape as a normal grounded response so the existing answer validator, source
view, provider label, audit record, and fallback logic all execute.

## One scenario manifest prevents drift across tests and recordings

`validation/provider-scenarios.json` will define the supported names, platforms, ability state,
generation result or error, event timing, and evidence class. It has no customer text or
credentials.

The manifest is the contract for TypeScript tests, native debug harnesses, Maestro flows, recording
metadata, and documentation. Native loaders reject malformed records and unknown error codes.
Release validation checks that every scenario used by a flow exists in the manifest and that every
manifest scenario has at least one automated assertion.

The manifest is bundled only in debug simulator and emulator builds. Android adds it to the debug
asset source set. iOS adds it through a debug-only build phase that copies the single file into the
application bundle. Production archives must fail validation if the file or a harness launch key
is present.

## Simulator journeys prove complete application behavior

The simulator runner starts a clean application instance for one scenario at a time and runs the
existing onboarding, provider status, chat, answer provenance, fallback, outbox, and deletion
flows. It captures structured results before it creates optional media.

The needed assertions are:

- provider status copy matches the scenario without exposing internal AICore terminology;
- unavailable providers do not receive a prompt;
- the app ignores streamed tokens from another request;
- cancellation stops the matching request and does not save a partial answer as complete;
- a busy, quota, background, or setup error selects the next operator-approved provider;
- citations and provider/model identity survive generation and persistence;
- simulated model identity is visible in details and audit output;
- offline-only policy never chooses the cloud fallback;
- release builds do not activate the harness even when passed a test launch value.

Maestro remains the visible journey driver. Jest validates the manifest and TypeScript behavior.
Swift and Kotlin unit tests validate native parsing, events, cancellation, and release-build gates.
CI runs deterministic tests and build checks. It does not need a model download or paid device
service.

## The Apple host runner executes the real system model on macOS

Airgap will add a Swift command-line runner that imports `FoundationModels` on macOS 26 or newer.
It accepts newline-delimited JSON requests on standard input and writes newline-delimited JSON
results on standard output. A Node wrapper prepares grounded evaluation cases, invokes the runner,
validates its output, and writes the evidence report under `tmp/provider-validation/`.

The runner supports two modes.

- `--probe` reports operating-system version, model availability, locale support, context size,
  and model identity without treating an unavailable model as a failed repository check.
- `--require-available` fails when Apple Intelligence or the system model is unavailable and is
  used for a release evidence run.

When available, the runner uses the same system instructions, grounded documents, output bounds,
and evaluation case identifiers as the mobile provider. It records first-token time, total time,
result length, refusal or error, and model identity. It never stores raw customer conversations;
the evaluation corpus has fictional project fixtures.

The current development Mac loads the framework but reports
`appleIntelligenceNotEnabled`. Enabling Apple Intelligence is a user-controlled system-settings
step. The repository will not change that setting automatically.

A host result proves Apple model behavior for the recorded macOS model version. It does not prove
iPhone thermal behavior, memory pressure, background transitions, or iOS device eligibility.

## Android uses controlled AICore behavior and optional local inference load

The available Android 15 emulator does not contain the `com.google.android.aicore` package. The ML
Kit Prompt API so cannot do genuine Gemini Nano inference there.

The controlled Android harness covers the AICore contract and complete application behavior. An
optional load journey can select Airgap's existing `llama.rn` provider with an operator-supplied
GGUF file to exercise local model loading, kept streaming, cancellation, memory pressure, and
context fallback in the emulator. The report labels this provider and model exactly; it never
labels downloaded-model output as Gemini Nano.

The optional model path stays outside the repository. Tests skip the load journey with an explicit
reason when no model path is supplied. CI continues to use the deterministic scenarios.

## Remote physical devices are a narrow, replaceable release step

The repository will give a preflight command for remote or attached target devices. It checks
the selected device against the operator-kept device matrix, confirms a locked production
configuration where the platform exposes that fact, installs the debug evidence build, and runs
only the hardware-dependent cases.

The first Android remote option is Firebase Test Lab because it supports real hosted devices and a
command-line test matrix. The repository will not create a cloud project, enable billing, or store
credentials. A maintainer supplies a project and selects a physical model. Preflight must first
confirm that the chosen lab device exposes a ready AICore service; hosted physical hardware alone
does not guarantee that the Prompt API model is initialized.

The target-device suite records:

- manufacturer and model;
- physical rather than virtual device form;
- operating-system version and build;
- provider-reported base model identity;
- provider availability and setup result;
- model download behavior when applicable;
- grounded answer, refusal, cancellation, quota, and background behavior;
- latency, memory, battery delta, and thermal state when the platform exposes them;
- application commit, prompt-pack version, and knowledge version.

The same suite can run on a locally attached phone. The evidence format does not depend on a
specific device-lab vendor.

## Evidence records are machine-checkable and claim-safe

Every validation report uses one schema with these needed fields:

- schema version;
- evidence class;
- provider ID and model identity;
- platform, device class, operating-system version, and build;
- application commit, prompt-pack version, and knowledge version;
- scenario or evaluation case ID;
- start time, duration, result status, and normalized error;
- generation method: model, script, or deterministic formatter;
- capture command and optional recording path.

The validator enforces the following rules.

- `deterministic-runtime` must record the deterministic formatter and no model output.
- `simulated-provider` must use a model identity beginning with `simulated/`.
- `host-native-model` must name the host operating system and cannot claim an iPhone or Android
  device.
- `target-device` must record a physical device model, OS build, and provider-reported model
  identity.
- A public recording cannot claim target-device provider evidence unless its capture
  `evidenceClass` includes `physical-device` and its referenced report passes the target-device
  rules.
- Reports with unavailable models are valid environment observations but do not satisfy a release
  provider gate.

Generated reports stay under `tmp/` by default. A maintainer may promote a reviewed report into a
versioned release-evidence directory when publishing a release.

## Documentation explains what each test proves

The README evidence table, `PRODUCT-AUDIT.md`, `ROADMAP.md`, `docs/recordings.md`, and a new provider
validation guide will use the three evidence classes consistently. Public GIF captions will state
whether the provider response is scripted, uses a real host model, or comes from target hardware.

The docs will include exact commands for:

- listing scenarios;
- launching an iOS Simulator or Android Emulator scenario;
- running the deterministic provider suite;
- probing the Apple host model;
- running the Apple host evaluation when available;
- supplying an optional GGUF path for Android load testing;
- checking a remote-device preflight without creating external infrastructure;
- validating a report before using it in release notes.

Historical plans stay historical. Current product claims live in the README, product audit,
roadmap, and validation guide.

## Release and safety boundaries stay explicit

The harness does not weaken provider policy, authentication, tool authorization, answer
validation, signed knowledge, encrypted storage, or offline mode. It does not send evaluation
prompts to a cloud model. Debug simulation must be impossible to activate in a production archive.

This work does not claim that Apple host results equal iPhone results, that a local downloaded
model equals Gemini Nano, that a hosted device is ready before AICore preflight passes, or that an
industry template meets a regulatory need.

The feature is complete when all deterministic scenario tests pass on both simulators, the Apple
host probe produces a valid environment report, the optional local-load path fails safely when no
model is supplied, release builds reject harness activation, documentation passes local link
checks, and the evidence validator rejects mislabeled reports. Target-device evidence remains a
release gate for production claims, not a prerequisite for everyday development.
