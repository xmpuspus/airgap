# Validate answer providers without overstating the result

Airgap has repeatable provider checks for normal answers, setup states, downloads, fallback,
cancellation, and provider failures. Most application behavior can be checked on an iOS Simulator
or Android Emulator. Hardware eligibility, system-model availability, performance, heat, memory,
and battery use still need a supported physical device.

## Provider evidence and capture hardware are separate facts

Provider reports and recordings use one of four `providerEvidenceClass` values.

| Provider evidence class | What it proves                                                                    |
| ----------------------- | --------------------------------------------------------------------------------- |
| `deterministic-runtime` | The real local retrieval and document-formatting path ran without model output    |
| `simulated-provider`    | The app, native bridge, provider state, streaming, failure, fallback, and UI path |
| `host-native-model`     | A real platform model generated output on the named development host              |
| `target-device`         | The named provider and model ran on the named physical mobile device and OS build |

Recording `evidenceClass` describes only the capture hardware: `emulator`, `simulator`, or
`physical-device`. It does not say whether a real model generated the answer. For example, an iOS
Simulator recording can have `evidenceClass: simulator` and `providerEvidenceClass:
simulated-provider`. Only a physical-device capture with a valid target report may claim
`target-device` provider evidence.

## Check the manifest and native parsers

The checked manifest at [`../validation/provider-scenarios.json`](../validation/provider-scenarios.json)
is the source for the TypeScript, Swift, Kotlin, and Maestro harnesses. List and validate it before a
provider run.

```bash
npm run providers:scenarios
npm run providers:validate
npm test -- --runInBand __tests__/scripts/provider-validation.test.js \
  __tests__/scripts/provider-runner.test.js
npm run providers:swift:test
cd android
./gradlew testDebugUnitTest --tests '*ProviderHarnessTest'
cd ..
```

The scenarios cover available, busy, cancelled, oversized-context, failed, setup, disabled,
unsupported-locale, quota, and device-ineligible behavior. Android also covers download and
background states. The harness is available only in Debug builds, and every simulated model
identity begins with `simulated/`.

These tests prove manifest parsing and controlled provider behavior. They do not contact Apple or
Google model services and do not prove that a mobile device is eligible.

## Run the complete app journey on virtual devices

Install Maestro and keep the tracked working tree clean. The runner clears only the selected app's
local test state, launches the named scenario through the native bridge, checks provider readiness
and the generated or fallback answer, and writes a report under `tmp/provider-validation/`.

Build and install iOS Debug with normal simulator signing. An unsigned
`CODE_SIGNING_ALLOWED=NO` build can prove compilation but cannot open the Keychain-backed stores
needed at app startup.

```bash
xcrun simctl list devices booted
RCT_METRO_PORT=8081 xcodebuild \
  -workspace ios/Airgap.xcworkspace \
  -scheme Airgap \
  -configuration Debug \
  -destination 'platform=iOS Simulator,id=<simulator-udid>' \
  build

npm run providers:scenario -- \
  --platform ios \
  --scenario available \
  --device <simulator-udid>
```

Build, install, and run Android Debug on an emulator.

```bash
cd android
./gradlew installDebug
cd ..
adb devices
npm run providers:scenario -- \
  --platform android \
  --scenario available \
  --device emulator-5554
```

Replace `available` with a platform-supported scenario from `npm run providers:scenarios`. A
successful run produces `simulated-provider` evidence because the response comes from the debug
manifest. It does not become target-device evidence just because the full app and native
bridge ran.

Validate one or more generated reports explicitly.

```bash
npm run providers:validate -- \
  tmp/provider-validation/ios-simulated-available-<timestamp>.json \
  tmp/provider-validation/android-simulated-available-<timestamp>.json
```

## Probe and evaluate Apple's host model

On macOS 26 or newer, the Swift runner can inspect the real Foundation Models framework without
changing system settings.

```bash
npm run providers:apple:probe
npm run providers:validate -- tmp/provider-validation/apple-host-probe-<timestamp>.json
```

An unavailable probe is a valid environment observation, not proof of model generation. The latest
maintainer check on 2026-08-13 loaded the framework on an Apple-silicon Mac but returned
`appleIntelligenceNotEnabled`. Enabling Apple Intelligence is a manual owner action in System
Settings. Airgap does not change it.

After the owner enables Apple Intelligence and the probe reports availability, run the three
fictional grounded cases.

```bash
npm run providers:apple:evaluate
npm run providers:validate -- tmp/provider-validation/apple-host-evaluation-<timestamp>.json
```

A passing result is `host-native-model` evidence for the recorded Mac model, macOS version, prompt
pack, and knowledge version. It does not prove iPhone eligibility, memory use, thermal behavior,
background behavior, or mobile latency.

## Check a physical-device candidate before claiming target evidence

The local preflight records device facts and refuses virtual devices. It does not change Apple
Intelligence settings, create a Firebase project, enable billing, or install credentials.

```bash
npm run providers:device:preflight -- \
  --platform ios \
  --device <physical-device-udid>

npm run providers:device:preflight -- \
  --platform android \
  --device <adb-serial>
```

Android target preflight also needs `com.google.android.aicore`. An Android emulator without
AICore is useful for `simulated-provider` checks but cannot run genuine ML Kit Prompt API output.
A physical or hosted device still needs a ready provider before it can satisfy the release gate.

Firebase Test Lab preflight needs an existing authenticated `gcloud` installation, project, and
physical model choice. The first command checks configuration only. Add `--execute` only when the
owner approves the external matrix and supplies an APK.

```bash
npm run providers:device:preflight -- \
  --firebase \
  --project <gcp-project> \
  --model <physical-model-id> \
  --form physical

npm run providers:device:preflight -- \
  --firebase \
  --project <gcp-project> \
  --model <physical-model-id> \
  --form physical \
  --version <android-api> \
  --app <debug-apk> \
  --execute
```

Preflight proves only that the selected target meets the checked prerequisites. A target-device
report still needs real generation, failure, cancellation, performance, and provenance results.

## Exercise downloaded-model loading with an operator-supplied GGUF

The repository does not contain a model file. When `airgap.config.json` has the expected filename,
byte count, and SHA-256, place a matching file into the selected Android app sandbox with this
command.

```bash
npm run providers:android:prepare-model -- \
  --device <adb-serial> \
  --model /absolute/path/to/the-configured-model.gguf
```

The tool checks the local file, uses `/data/local/tmp` only as a transfer point, copies through
`run-as com.airgap`, checks the device-side SHA-256, and removes the transfer file. A downloaded
GGUF run proves only the named `llama.rn` model path. It must never be labeled Apple Foundation
Models, Gemini Nano, or Android system AI.

## Review reports before release use

Generated reports stay ignored under `tmp/` and can contain machine and device details. Do not
commit them by default. To use a report as release evidence:

1. Confirm the application commit, provider ID, model identity, platform, device class, OS build,
   prompt pack, knowledge version, case ID, and capture command.
2. Run `npm run providers:validate -- <report-path>` without editing the report class.
3. Confirm unavailable observations are not described as passing model runs.
4. Confirm simulated, host, and downloaded-model results are not described as physical mobile
   provider results.
5. Publish the reviewed file as a versioned CI or release artifact under the project's normal
   retention and privacy rules. Keep customer prompts, credentials, tokens, and model files out of
   the report.

The report validator checks evidence shape and claim boundaries. It cannot determine answer
quality, approve an industry use, certify privacy or compliance, or replace manual inspection of a
recording and target-device run.
