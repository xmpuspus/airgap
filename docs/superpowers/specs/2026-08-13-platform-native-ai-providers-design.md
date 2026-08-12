# Airgap needs platform-native inference providers

Written 2026-08-13

## Airgap needs more than one offline generation provider

Airgap currently retrieves local documents and sends the grounded prompt to one
native inference adapter, `llama.rn`. This works across Android and iOS on
suitable hardware, but each operator must host and deliver a model file of about
2.4 GB. Apple and Google now expose system-managed on-device language models on
some recent devices.

Airgap will add Apple Foundation Models and Android ML Kit GenAI as optional
providers. It will keep `llama.rn`, authenticated cloud generation, and the
deterministic document formatter as fallbacks. Operators will choose which
providers a support domain can use.

The work covers runtime architecture, native bridges, configuration, user
experience, tests, documentation, and real device recordings. It does not add a
hosted control plane or claim that an industry template meets a regulation.

## The system model phrases approved company information

The system model is not a source of company facts. Airgap retrieves approved
local documents before it asks any model to make text. The existing safety
layer checks the result against those documents.

The data flow follows.

```text
Customer question
  -> local document retrieval
  -> domain and action policy
  -> provider resolver
       Apple system model
       Android system model
       Airgap-downloaded model
       authenticated cloud model
       deterministic formatter
  -> grounded-answer validation
  -> answer, sources, provider state, and offline state
```

Airgap keeps tool choice, authentication, confirmation, state-changing actions,
the encrypted outbox, and receipts outside the native language models. A later
release can use native tool calling for read-only retrieval after separate
evaluation. This release does not let a model approve or run a sensitive
action.

## A system-first provider chain gives the best coverage

The design compares three paths.

### Use system models with controlled fallbacks

Airgap tries a permitted and ready system model first. It then tries the
operator-approved downloaded or cloud provider. It uses the deterministic
formatter when no generative provider is available.

This approach avoids a separate model download on supported devices while it
keeps the current device reach. It lets operators disable a provider when
its terms, supported audience, language, region, or model quality do not fit the
deployment.

### Keep `llama.rn` while LiteRT-LM gets device tests

LiteRT-LM could give one custom-model runtime across Android and iOS. A full
replacement would expand the first change, remove a working fallback before the
new providers have device evidence, and couple system-model adoption to a model
format migration. Airgap will benchmark LiteRT-LM later through the same provider
contract.

### Do not keep only `llama.rn`

Keeping one adapter would avoid native bridge work, but eligible devices would
still need the large Airgap model download. It would leave platform-managed
acceleration and system model updates unused.

## One contract controls all local and cloud generation

The TypeScript runtime will define an `InferenceProvider` contract with these
operations.

- `getCapabilities()` returns provider identity, availability, readiness,
  context size, supported locale state, streaming support, and setup state.
- `generate()` accepts instructions, a grounded prompt, an optional token
  callback, and a cancellation signal.
- `cancel()` stops the active request when the provider supports cancellation.
- `getLastRunStats()` returns load time, first-token time, total time, token
  count, provider name, and model identity.

All provider failures use this small shared set of reasons.

- `unsupported_device`
- `unsupported_os`
- `unsupported_locale`
- `provider_disabled`
- `model_not_ready`
- `download_required`
- `busy`
- `quota_exceeded`
- `background_blocked`
- `context_exceeded`
- `generation_failed`
- `cancelled`

The provider resolver uses fresh capabilities for every request. It does not
cache a ready state across operating-system changes, model downloads, user
settings changes, or a move to the background.

The answer result records the provider and model identity. The visible source
class stays `local` or `cloud` for compatibility, while audit data adds the exact
provider. Customer text stays out of telemetry by default.

## Operator policy decides which provider can run

The `llm` configuration will add an ordered `providers` array. Each entry states
the following values.

- provider ID
- enabled state
- priority
- allowed support domains
- blocked support domains
- oldest operating-system version
- locale allowlist
- whether the provider can request a model download
- whether the provider can fall back to cloud generation

This release recognizes these provider IDs.

- `apple-foundation-models`
- `android-aicore`
- `llama-rn`
- `cloud`
- `demo`

Existing configurations without a provider list keep their current behavior.
`demo` remains an operator-only mode. The schema validator rejects duplicate
providers, unknown IDs, an empty enabled chain, and platform providers on the
wrong platform when a platform restriction is explicit.

An operator can disable Android AICore for under-18 audiences, clinical
practice, medical advice, or other uses that do not fit Google's terms. An
operator can limit Apple Foundation Models where unsupervised output could make
a material high-risk decision. These checks supplement legal review. They do
not replace it.

## Apple Foundation Models is the first native adapter

The iOS module uses the Foundation Models framework when the following
conditions hold.

- iOS 26 or newer
- Apple Intelligence device eligibility
- Apple Intelligence enabled
- system model available
- application locale supported
- provider allowed by operator policy

The module reports Apple's availability reason without sending a prompt. It
streams response text to React Native, supports cancellation, reports context
size and token counts where the OS supplies them, and normalizes native errors.

The app keeps its iOS 15.1 deployment target. The module uses availability
checks and a fallback on older or ineligible devices. It does not include a
custom Apple model adapter or use Private Cloud Compute in this release.

Apple changes the system model through operating-system updates. So evaluation
results include the device, OS build, available model identity, prompt
pack version, knowledge version, and application commit.

## Android AICore is an optional native adapter

The Android module uses ML Kit's GenAI Prompt API when the following conditions
hold.

- Android API 26 or newer
- supported AICore device and configuration
- feature status is available or downloadable
- application is in the foreground
- provider allowed by operator policy

The main app keeps Android API 24 as its lowest target. API 24 and 25 devices use another
provider.

The module exposes AICore feature status and a user-controlled download. It
supports warmup, streaming, cancellation where available, base-model identity,
and normalized quota, battery, background, setup, and bootloader errors. It
keeps the grounded input under 4,000 tokens.

The resolver at once tries the next allowed provider after a busy, quota,
background, or setup error. It does not retry the same provider in a tight loop.

## The interface explains ability without exposing technical details

Onboarding replaces the single generic model-download path with four states.

- **System AI ready.** Continue without an Airgap model download.
- **System AI needs setup.** Explain the platform setting or system model
  download, with a retry action.
- **Download Airgap model.** Show operator-approved size, Wi-Fi guidance,
  progress, cancellation, integrity status, and fallback availability.
- **Document answers only.** Continue with retrieved document formatting when no
  generative provider is ready.

The chat header keeps the current Local, Cloud, Demo, and Offline language.
Answer provenance adds a plain provider label in the detail view. The settings
screen shows provider order, current provider, model readiness, exact model
identity when available. It explains why a provider cannot run.

The user never has to choose a technical runtime name to start. Advanced
settings can let an operator or tester choose offline-only, prefer-offline, or
prefer-online behavior within the operator provider policy.

## Tests cover routing, native contracts, and model drift

The work follows test-driven development. TypeScript tests use fake
providers through dependency injection and check the following cases.

- ordered choice of ready and permitted providers
- fallback for every normalized failure reason
- offline-only mode never choosing cloud
- operator policy taking priority over user preference
- model and provider identity in audit data
- cancellation and concurrent generation
- existing configurations keeping their behavior
- onboarding and settings states for every provider state

Native unit tests cover availability and error mapping. Android instrumentation
and iOS device tests cover the real platform frameworks on devices that let them
run.

Every provider runs the existing single-turn, multi-turn, adversarial, refusal,
and industry suites. The release evidence groups results by provider, model
identity, OS build, prompt pack, knowledge version, device, and application
commit. A system model update creates a new support row and must pass the release
thresholds before the project calls it supported.

Physical-device checks record first-token latency, total latency, memory, battery
use, thermal state, cancellation, foreground transitions, model setup, and
fallback behavior. Host fixtures do not satisfy this gate.

## Documentation and recordings match tested devices

The README will add a provider and device support table, the provider fallback
order, privacy boundaries, setup behavior, and current evidence. The deployment
guide will cover configuration, Apple and Android build requirements, operator
policy, and troubleshooting. The roadmap will move the second native inference
adapter from Later to Now.

The project will rerecord real Android and iOS GIFs after both adapters pass
physical-device checks. Recording metadata will include the commit, device, OS,
provider, model identity, knowledge version, and capture command. The README will
not label emulator or simulator footage as physical-device evidence.

## Photo and voice intake follow the provider release

Photo and voice improve offline support, but they do not block the first provider
release. The next bounded change will use Apple Vision and bundled Android ML Kit
text recognition to extract text from error screens, bills, meters, labels, and
travel documents. Airgap will retrieve documents from the extracted text before
generation.

Apple SpeechAnalyzer is the preferred Apple transcription path. Android will use
a stable traditional on-device speech path before it considers the alpha GenAI
speech API. Audio, images, and extracted text need separate consent, retention,
deletion, accessibility, and evaluation requirements.

## A production pilot needs an operator integration

The open-source runtime can build and test provider behavior without a live
operator. A production pilot needs the following work.

- a real identity-provider integration
- production backend methods and authorization
- confirmation, idempotency, receipts, and reconciliation
- live-agent or callback handoff
- reviewed, signed, expiring knowledge releases
- crash reporting and privacy-safe diagnostics
- durable rate limits, audit records, key rotation, and incident response
- accessibility automation and domain-reviewed localization
- store review material from the operator's legal entity where needed

The estimated engineering range is twelve to eighteen weeks for one production
pilot with two mobile engineers, one backend engineer, and part-time product,
design, QA, security, and domain review. Two independently checked industry
deployments and a broader device matrix are a six-to-nine-month program. These
ranges assume prompt access to supported physical devices and operator test
systems.

## Release gates need device and operator evidence

The following gates mark provider release completion.

- airplane-mode tests show no support payload leaves the device during local
  questions
- every supported device has a checked fallback for disabled, absent,
  downloading, busy, quota-limited, background-blocked, and out-of-context states
- the release corpus has no severe unsupported facts, amounts, dates, or
  completed-action claims
- sensitive actions always pass deterministic policy, authentication,
  confirmation, idempotency, and receipt checks
- each provider passes agreed source-support, refusal, latency, memory, battery,
  thermal, accessibility, and cancellation thresholds on named devices
- every system-model change triggers the provider evaluation suite
- each industry template states its supported questions, refusals, content owner,
  expiry policy, and human handoff conditions
- README claims and real GIF recordings match the checked commit and evidence

The first build produces only a release candidate. Physical-device evidence and
a real operator integration set production readiness.

## Official platform sources set the provider limits

- [Apple Foundation Models](https://developer.apple.com/documentation/FoundationModels)
- [Apple system model availability](https://developer.apple.com/documentation/foundationmodels/systemlanguagemodel)
- [Apple model update guidance](https://developer.apple.com/documentation/foundationmodels/updating-prompts-for-new-model-versions)
- [Apple acceptable use requirements](https://developer.apple.com/apple-intelligence/acceptable-use-requirements-for-the-foundation-models-framework/)
- [Android ML Kit GenAI overview](https://developers.google.com/ml-kit/genai)
- [Android Prompt API](https://developers.google.com/ml-kit/genai/prompt/android/get-started)
- [ML Kit GenAI terms](https://developers.google.com/ml-kit/genai-terms)
- [Play for On-device AI](https://developer.android.com/google/play/on-device-ai)
