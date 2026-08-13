# Deploy a branded Airgap app

Airgap supplies a checked mobile runtime, configuration schema, example content,
native inference bridges, and a reference server. A production deployment still
needs organization-specific identity, documents, action authorization, support
ownership, monitoring, legal review, and target-device testing.

## Build prerequisites

| Tool or target     | Needed version                         | Reason                                                 |
| ------------------ | -------------------------------------- | ------------------------------------------------------ |
| Node.js            | 22.11 or newer                         | Repository and CLI scripts                             |
| JDK                | 17                                     | Android Gradle build                                   |
| Android SDK        | 36 installed                           | Current compile and target SDK                         |
| Android runtime    | API 24 or newer                        | Base app (system AI needs API 26 or newer)             |
| Xcode              | 26 or newer                            | Compiles the Foundation Models bridge                  |
| iOS runtime        | 15.1 or newer                          | Base app (Apple on-device model needs iOS 26 or newer) |
| Ruby and CocoaPods | Versions from the repository lockfiles | iOS dependency installation                            |

Use an Apple Intelligence-capable physical device for Apple model evaluation.
Use a device listed in Google's current
[Prompt API support table](https://developers.google.com/ml-kit/genai) for
Android system AI evaluation. A simulator or emulator can check interface and
fallback behavior but does not count as physical-device release evidence.

## Build the default demo first

```bash
git clone https://github.com/xmpuspus/airgap.git my-support-app
cd my-support-app
npm ci
npm run kb:validate
```

Run Android.

```bash
JAVA_HOME=/opt/homebrew/opt/openjdk@17 npm run android
```

Run iOS.

```bash
bundle install
cd ios
bundle exec pod install
cd ..
npm run ios
```

The default `llm.mode` is `demo`. The app formats retrieved documents without a
model request, cloud generation request, or model download. Check this path
before enabling another provider.

## Replace brand and support content

Run the guided setup.

```bash
./scripts/setup.sh
```

Or change the files directly.

1. Edit `airgap.config.json` for brand, colors, provider policy, support routes,
   actions, retention, and prompts.
2. Replace JSON documents in `src/knowledge/`, or copy one of the seven examples.
3. Run `node scripts/generate-manifest.js`.
4. Run `npm run kb:validate` and the applicable industry journey.
5. Review every visible answer and refusal with the people who own the content.

For bulk imports, run this command.

```bash
node scripts/kb-import.js path/to/content.csv
```

System models phrase the documents Airgap retrieves. They are not a source for
prices, eligibility, policy, safety instructions, or account state.

## Set up provider policy

The resolver orders the provider array by ascending `priority`.

| Field                | Enforcement                                                                     |
| -------------------- | ------------------------------------------------------------------------------- |
| `id`                 | One of `apple-foundation-models`, `android-aicore`, `llama-rn`, `cloud`, `demo` |
| `enabled`            | Disabled entries do not run                                                     |
| `platform`           | Limits an entry to `ios`, `android`, or `all`                                   |
| `allowedDomains`     | Runs only for an exact support-domain match                                     |
| `blockedDomains`     | Excludes exact support-domain matches                                           |
| `minimumOsVersion`   | Compares current device-state data with the configured numeric version          |
| `locales`            | Runs only for an exact configured locale match                                  |
| `allowModelDownload` | Controls whether the app offers the provider model download                     |
| `allowCloudFallback` | On a cloud entry, controls whether cloud can enter the fallback chain           |

Use this as an offline production starting point.

```json
{
  "llm": {
    "mode": "offline-only",
    "supportDomain": "telco",
    "providers": [
      {
        "id": "apple-foundation-models",
        "enabled": true,
        "priority": 0,
        "platform": "ios",
        "minimumOsVersion": "26.0",
        "locales": ["en", "en-US"],
        "allowModelDownload": false,
        "allowCloudFallback": false
      },
      {
        "id": "android-aicore",
        "enabled": true,
        "priority": 0,
        "platform": "android",
        "minimumOsVersion": "26",
        "locales": ["en", "en-US"],
        "allowModelDownload": true,
        "allowCloudFallback": false
      },
      {
        "id": "llama-rn",
        "enabled": true,
        "priority": 10,
        "platform": "all",
        "allowModelDownload": true,
        "allowCloudFallback": false
      },
      {
        "id": "demo",
        "enabled": true,
        "priority": 30,
        "platform": "all"
      }
    ]
  }
}
```

`demo` mode chooses only `demo`. Change to `offline-only`, `prefer-offline`, or
`prefer-online` to activate a production provider chain. In `offline-only`, the
resolver always removes cloud even when an operator enables an entry.

## Enable Apple Foundation Models

The Swift bridge uses `SystemLanguageModel.default` and creates a new
`LanguageModelSession` for each request. It checks these conditions before it
sends a prompt.

- iOS 26 or newer
- Apple Intelligence device eligibility
- Apple Intelligence enabled
- system model available
- current locale supported
- provider permitted by Airgap policy

The bridge streams text deltas, supports request cancellation, reports current
OS and model identity, and maps context, locale, concurrency, rate, and
cancellation errors into the shared fallback contract.

No Apple model file ships with the app. Apple manages the system model and can
change it with an OS update. Record device model, OS build, Airgap commit,
knowledge version, prompt version, model identity, and evaluation result for
every supported combination. Apple's
[Foundation Models documentation](https://developer.apple.com/documentation/FoundationModels)
calls for prompt evaluation across model changes as well.

Airgap does not use Apple Private Cloud Compute. The provider in this repository
is the on-device `SystemLanguageModel` adapter only.

## Enable Android system AI

The Kotlin bridge uses this dependency.

```kotlin
implementation("com.google.mlkit:genai-prompt:1.0.0-beta2")
```

The base app keeps `minSdk 24`. The native module returns `unsupported_os`
before it initializes ML Kit on API 24 or 25. On API 26 or newer it checks
`AVAILABLE`, `DOWNLOADABLE`, `DOWNLOADING`, and `UNAVAILABLE` before generation.

For a downloadable model, onboarding starts the ML Kit download only when
`allowModelDownload` is true. The bridge reports progress, calls `warmup()`, and
refreshes provider status after completion. Keep the app in the foreground during
inference.

The bridge counts the joint instructions and retrieved document prompt. It
rejects input at 4,000 tokens or above and keeps enough capacity for output.
Google documents the same under-4,000-token input bound, per-app quotas,
foreground-only inference, and lack of support for unlocked bootloaders in the
[Prompt API setup guide](https://developers.google.com/ml-kit/genai/prompt/android/get-started).

Complete these checks before production use.

1. Check the current device support table and every language you plan to offer.
2. Accept and review the ML Kit and GenAI terms with counsel.
3. Do not enable this provider in a client directed to people under 18.
4. Do not use it for clinical practice or medical advice.
5. Do not present output as medical, legal, financial, or other professional
   advice.
6. Show Google's ML Kit metrics processing and possible contacts for model,
   fix, and compatibility updates.

See the [ML Kit GenAI terms](https://developers.google.com/ml-kit/genai-terms)
and [ML Kit privacy terms](https://developers.google.com/ml-kit/terms). These are
deployment constraints. Treat them as needed product and privacy requirements.

## Set up the downloaded model

The checked sample points to Gemma 4 E2B Q3_K_S, about 2.4 GB. Set every
integrity field together if you replace it.

```json
{
  "model": {
    "url": "https://models.example.com/support/model.gguf",
    "filename": "support-model.gguf",
    "sizeBytes": 2625634304,
    "sizeMB": 2504,
    "sha256": "replace-with-64-lowercase-hex-characters"
  }
}
```

Airgap checks byte length and SHA-256 before loading the file. Model files are
not encrypted at rest. Do not put private customer data in a model file.

Use a host that supports HTTP range requests so interrupted downloads can
resume. Test storage pressure, cold load, peak memory, time to first token,
long-running generation, cancellation, app backgrounding, and thermal behavior on
the oldest supported physical device.

## Set up authenticated cloud fallback

Cloud generation needs all three controls.

1. `llm.mode` permits cloud.
2. Enable the `cloud` provider and do not set `allowCloudFallback` to false.
3. The app has an installed access-token provider for the set-up audience.

The device gets a fresh token for each request. Do not put bearer tokens,
OAuth client secrets, or long-lived API keys in `airgap.config.json`.

[`docs/hybrid-llm-design.md`](docs/hybrid-llm-design.md) documents the endpoint
contract. Apply organization-side
data classification, residency, retention, redaction, logging, and model policy
before customer text leaves a device.

## Connect knowledge sync and actions

The reference server under `server/` gives signed knowledge bundles,
authenticated API routes, bounded request bodies, rate headers, telemetry
acceptance, and health reporting. It supports integration tests and does not act
as a complete production control plane.

Start it with secrets from the environment.

```bash
export BFF_AUTH_TOKEN='replace-in-a-secret-manager'
node server/index.mjs --port 3000 --kb-root src/knowledge
```

Set up its URL, public signing key, and token provider in the app. Production
deployments need TLS, managed key rotation, durable rate limits, monitoring,
backup and recovery, real authorization, and business-system adapters.

Models never choose or run an action. The deterministic router chooses a set-up
route. The backend authenticates, authorizes, checks, and applies
the operation. If the device is offline, Airgap stores the request in the
encrypted outbox with an idempotency key.

## Signing and store builds

### Android

Create a release key outside version control, then expose values through the
build environment.

```bash
export AIRGAP_RELEASE_STORE_FILE=release.keystore
export AIRGAP_RELEASE_KEY_ALIAS=release
export AIRGAP_RELEASE_STORE_PASSWORD='from-your-secret-manager'
export AIRGAP_RELEASE_KEY_PASSWORD='from-your-secret-manager'
cd android
JAVA_HOME=/opt/homebrew/opt/openjdk@17 ./gradlew bundleRelease
```

Airgap leaves a release build unsigned when all four variables are absent and
stops when only some are present.

### iOS

1. Open `ios/Airgap.xcworkspace` in Xcode 26 or newer.
2. Choose the organization team in Signing and Capabilities.
3. Replace the sample bundle identifier.
4. Check Keychain entitlements, privacy declarations, and deployment target.
5. Choose a generic iOS device and then choose Product, Archive.
6. Upload through Organizer to TestFlight before App Store review.

Do not claim that an app collects no data only because generation is local.
Review knowledge sync, support actions, crash reporting, telemetry, ML Kit
metrics, backups, and connected systems when completing store disclosures.

## Physical-device release gate

For each supported device and OS/model identity, complete these steps.

1. Install a release-like build from the exact candidate commit.
2. Record provider availability, download state, model identity, locale, and OS.
3. Run grounded, refusal, adversarial, cancellation, long-context, quota, and
   background cases.
4. Compare output against approved documents and expected citations.
5. Test offline cold start, storage pressure, memory pressure, and thermal load.
6. Check screen reader, large text, reduced motion, contrast, and touch targets.
7. Record the command, result, device, OS, model, prompt pack, knowledge version,
   commit, and evidence class.
8. Mark release evidence as physical-device only when a named physical device
   ran the check.

System models can change independently of the app. Run the evaluation again
after any supported OS or model update.

## Roll out and roll back one provider at a time

Start with one representative device group and one support domain. Watch
provider choice, fallback reason, answer quality, latency, cancellation,
quota, download failure, and escalation rates. Do not send customer prompt text
to telemetry.

To roll back a provider, set its entry to `"enabled": false`, publish the
configuration through the normal controlled release path, and check that Settings
shows **Off by policy**. Preserve the downloaded model and other providers until
the incident review decides if it needs removal.

## Troubleshooting

### Apple provider is unavailable

- Check that Xcode 26 compiled the app and the device runs iOS 26 or newer.
- Check that the device supports Apple Intelligence and the person enabled it.
- Check that the system model finished preparing and supports the locale.
- Check `minimumOsVersion`, platform, locale, domain, and enabled state in policy.

### Android provider is unavailable or will not download

- Check API 26 or newer and current device support in Google's table.
- Update AICore, keep the device online, and allow its setup to finish.
- Check that the device uses a locked bootloader.
- Check that `allowModelDownload` is true and keep the app in the foreground.
- Retry later after a busy, quota, or battery-use limit.

### Downloaded model will not load

- Check for at least 3 to 5 GB of free storage.
- Match URL, filename, exact bytes, and SHA-256 to the hosted artifact.
- Check that the server supports range requests.
- Recheck memory and model compatibility on the target device.

### A provider falls through unexpectedly

- Open Settings and read the exact provider order, readiness, OS, and model ID.
- Check domain and locale allowlists.
- Check the answer card for the provider that actually completed the request.
- Reproduce with telemetry off and save only non-customer diagnostic facts.
