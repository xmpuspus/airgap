# Provider Validation Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build repeatable provider scenarios on iOS Simulator and Android Emulator, run the real
Apple system model on a compatible Mac, and keep physical-device claims behind a checked evidence
gate.

**Architecture:** One checked JSON manifest defines provider scenarios. Debug-only Swift and Kotlin
engines load the manifest through the existing native provider modules. Node tools validate evidence,
drive simulators, probe host and target environments, and add provider proof to recording metadata.

**Tech Stack:** React Native 0.84, TypeScript, Jest, Node.js 22, Swift 5 with Foundation Models,
Kotlin 2.1, Gradle, Maestro, Xcode Simulator, and Android platform tools.

**Spec:** `docs/superpowers/specs/2026-08-13-provider-validation-harness-design.md`

## Global Constraints

- Keep iOS 15.1 and Android API 24 as application deployment floors.
- Activate scenario behavior only in debug builds.
- Keep `evidenceClass` as the recording capture-device field.
- Add `providerEvidenceClass` with `deterministic-runtime`, `simulated-provider`,
  `host-native-model`, or `target-device`.
- Start every simulated model identity with `simulated/`.
- Do not store customer text, credentials, model files, or generated reports in Git.
- Do not create a cloud project, enable billing, or change Apple Intelligence settings.
- Preserve the three existing untracked recording files.
- Copy only tracked root sources into the packaged `create-airgap-bot` template.

---

### Task 1: Scenario manifest and provider evidence validator

**Files:**

- Create: `validation/provider-scenarios.json`
- Create: `scripts/lib/provider-validation.js`
- Create: `scripts/validate-provider-evidence.mjs`
- Create: `__tests__/scripts/provider-validation.test.js`
- Change: `package.json`

**Interfaces:**

- Produces: `PROVIDER_EVIDENCE_CLASSES`, `loadScenarioManifest(root)`,
  `validateScenarioManifest(manifest)`, and `validateProviderEvidence(report)`.
- Produces: `npm run providers:validate -- [report paths]`.
- Consumes: no earlier task output.

- [ ] **Step 1: Write the failing manifest and report tests**

Assert these sorted scenario IDs:

```js
expect(manifest.scenarios.map(item => item.id)).toEqual([
  'available',
  'background-blocked',
  'busy',
  'cancelled',
  'context-exceeded',
  'device-not-eligible',
  'downloadable',
  'downloading',
  'generation-failed',
  'model-not-ready',
  'provider-disabled',
  'quota-exceeded',
  'unsupported-locale',
]);
```

Add one passing report per provider evidence class. Add failures for a simulated identity without
`simulated/`, host evidence that claims an iPhone, target evidence on an emulator, and deterministic
evidence marked as model output.

- [ ] **Step 2: Confirm red**

Run:

```bash
npm test -- --runInBand __tests__/scripts/provider-validation.test.js
```

Expected: Jest fails because the manifest and validator module do not exist.

- [ ] **Step 3: Add the manifest and validator**

Use `schemaVersion: 1`. Each scenario has `id`, sorted `platforms`, per-platform ability data,
and either fixed `tokens` plus `text` or one normalized `error`. Validate unique sorted IDs,
known platforms, fixed event bounds, and simulated model prefixes.

Use this report contract:

```js
{
  schemaVersion: 1,
  evidenceClass: 'simulated-provider',
  providerId: 'apple-foundation-models',
  modelIdentity: 'simulated/apple-system-model',
  platform: 'ios',
  deviceClass: 'simulator',
  osVersion: '26.4',
  osBuild: 'unknown',
  appCommit: '40-character-lowercase-sha',
  promptPackVersion: '1',
  knowledgeVersion: 'built-in',
  caseId: 'available',
  startedAt: 'ISO-8601 timestamp',
  durationMs: 10,
  status: 'passed',
  generationMethod: 'script',
  captureCommand: 'npm run providers:scenario -- ...'
}
```

- [ ] **Step 4: Add commands and check green**

Add `providers:validate` and `providers:scenarios` scripts. Run the focused Jest test and
`npm run providers:validate`.

- [ ] **Step 5: Commit**

Stage only the task files and commit with `Add provider evidence validation`.

### Task 2: Recording provider-proof metadata

**Files:**

- Change: `scripts/lib/recordings.js`
- Change: `demo/recordings.json`
- Change: `__tests__/scripts/validate-recordings.test.js`

**Interfaces:**

- Consumes: provider evidence names from Task 1.
- Produces: needed `providerEvidenceClass` on each schema-v2 recording.
- Keeps: existing capture-device `evidenceClass` with no meaning change.

- [ ] **Step 1: Add failing recording tests**

Add `providerEvidenceClass: 'deterministic-runtime'` to the fixture. Assert rejection for a missing
or unknown class, `target-device` on nonphysical capture, and `simulated-provider` without a
`simulated/` identity.

- [ ] **Step 2: Confirm red**

Run `npm test -- --runInBand __tests__/scripts/validate-recordings.test.js`.

- [ ] **Step 3: Add the rule and update all ten records**

Set all ten existing records to `deterministic-runtime`. Do not edit GIFs, byte counts, duration,
source commits, or capture facts.

- [ ] **Step 4: Check**

Run the focused Jest test and `npm run recordings:validate`.

- [ ] **Step 5: Commit**

Commit with `Label provider proof in release recordings`.

### Task 3: Shared native scenario engines

**Files:**

- Create: `ios/Airgap/ProviderHarness.swift`
- Create: `scripts/provider-harness-swift-tests/main.swift`
- Create: `android/app/src/main/java/com/airgap/inference/ProviderHarness.kt`
- Create: `android/app/src/test/java/com/airgap/inference/ProviderHarnessTest.kt`
- Change: `ios/Airgap.xcodeproj/project.pbxproj`
- Change: `android/app/build.gradle`
- Change: `package.json`

**Interfaces:**

- Consumes: `validation/provider-scenarios.json`.
- Produces: Swift `ProviderHarness.load(bundle:arguments:)`.
- Produces: Kotlin `ProviderHarness.load(json:scenarioName:)`.
- Returns: ID, platform ability data, fixed tokens or normalized error, and download progress.

- [ ] **Step 1: Write failing native parser tests**

Swift and Kotlin load the real manifest. Check `available` on both platforms, `downloadable` only
on Android, unknown scenario failure, trimmed scenario names, and every simulated identity prefix.

- [ ] **Step 2: Confirm red**

```bash
npm run providers:swift:test
cd android && ./gradlew testDebugUnitTest --tests '*ProviderHarnessTest'
```

Expected: both harness sources are missing.

- [ ] **Step 3: Implement pure engines**

Use Foundation `Decodable` in Swift and `org.json` in Kotlin. Keep parsing independent from React
Native. Add JUnit and JVM `org.json` only to Android test dependencies.

- [ ] **Step 4: Wire debug resources**

Add the Swift source to the app target. Add one iOS build phase that copies the manifest only for
Debug. Add the root `validation` directory to Android debug assets only.

- [ ] **Step 5: Check parsers and release exclusion**

Run both native parser tests and `./gradlew assembleRelease`. Open the release APK as ZIP and
confirm `provider-scenarios.json` is absent.

- [ ] **Step 6: Commit**

Commit with `Add native provider scenario engines`.

### Task 4: Run scenarios through existing provider contracts

**Files:**

- Change: `ios/Airgap/AppleFoundationModelsModule.swift`
- Change: `android/app/src/main/java/com/airgap/inference/AndroidAicoreModule.kt`
- Create: `src/services/inference/providerHarness.ts`
- Change: `src/services/llmRouter.ts`
- Change: `src/hooks/useInferenceProviders.ts`
- Change: `__tests__/apple-foundation-models-provider.test.ts`
- Change: `__tests__/android-aicore-provider.test.ts`
- Create: `__tests__/provider-harness.test.ts`
- Change: `__tests__/inference-provider-resolver.test.ts`

**Interfaces:**

- Consumes: native engines from Task 3.
- Produces: `activeProviderHarnessScenario()` and `providerHarnessActive()`.
- Keeps: existing native module names and normal production calls.

- [ ] **Step 1: Add failing tests**

Mock native constants with `harnessScenario: 'available'`. Check development-only activation,
`prefer-offline` override, simulated identity, token isolation, normalized failures, and resolver
fallback for busy, quota, background, setup, and context errors.

- [ ] **Step 2: Confirm red**

```bash
npm test -- --runInBand __tests__/provider-harness.test.ts   __tests__/apple-foundation-models-provider.test.ts   __tests__/android-aicore-provider.test.ts   __tests__/inference-provider-resolver.test.ts
```

- [ ] **Step 3: Add debug native operations**

iOS reads `-AirgapProviderScenario <id>`. Android reads the
`airgapProviderScenario` intent extra. Export `harnessScenario` only in debug. When active,
`getCapabilities`, Android download and warmup, generation, event streaming, errors, and
cancellation use the manifest. With no scenario, keep current Apple and ML Kit execution.

- [ ] **Step 4: Add the TypeScript mode override**

Make `getConfigMode()` return `prefer-offline` only while the debug harness is active. Make
`useInferenceProviders` call `getMode()` so Settings lists platform providers during a run.

- [ ] **Step 5: Check**

Run focused Jest, `npx tsc --noEmit`, both native parser tests, Android Debug assembly, and an
unsigned iOS Simulator Debug build.

- [ ] **Step 6: Commit**

Commit with `Run provider scenarios through native bridges`.

### Task 5: Apple host model probe and evaluation

**Files:**

- Create: `validation/apple-host-cases.json`
- Create: `scripts/apple-foundation-models-runner.swift`
- Create: `scripts/evaluate-apple-host.mjs`
- Create: `__tests__/scripts/apple-host-evaluator.test.js`
- Change: `package.json`

**Interfaces:**

- Consumes: `validateProviderEvidence(report)`.
- Produces: `providers:apple:probe` and `providers:apple:evaluate`.
- Writes: `tmp/provider-validation/apple-host-*.json` only.

- [ ] **Step 1: Write failing wrapper tests**

Test `parseRunnerLine(line)`, `buildHostReport(raw, context)`, and
`outputPath(root, startedAt)`. Check unavailable probe, available case IDs, and malformed output.

- [ ] **Step 2: Confirm red**

Run `npm test -- --runInBand __tests__/scripts/apple-host-evaluator.test.js`.

- [ ] **Step 3: Implement the Swift runner**

Support `--probe` and `--require-available`. Probe writes OS, availability reason, locale support,
context size, and identity. Evaluation reads JSON lines and writes case ID, status, text or error,
first-token time, total time, and output length.

- [ ] **Step 4: Add three fictional cases and Node wrapper**

Use telco troubleshooting, water restoration, and airline baggage cases. Each has a system prompt,
question, approved document, prompt-pack version, and knowledge version.

- [ ] **Step 5: Check the real probe**

```bash
npm test -- --runInBand __tests__/scripts/apple-host-evaluator.test.js
npm run providers:apple:probe
npm run providers:validate -- tmp/provider-validation/apple-host-*.json
```

An `appleIntelligenceNotEnabled` probe passes as an environment observation but not as model-ready
release proof.

- [ ] **Step 6: Commit**

Commit with `Add Apple host model evaluation`.

### Task 6: Simulator runner and target-device preflight

**Files:**

- Create: `scripts/run-provider-scenario.mjs`
- Create: `scripts/provider-device-preflight.mjs`
- Create: `scripts/prepare-android-model.mjs`
- Create: `scripts/recording-flows/provider-scenario-ios.yaml`
- Create: `scripts/recording-flows/provider-scenario-android.yaml`
- Create: `__tests__/scripts/provider-runner.test.js`
- Change: `package.json`

**Interfaces:**

- Consumes: scenario and report validation from Task 1.
- Produces: `providers:scenario`, `providers:device:preflight`, and
  `providers:android:prepare-model`.

- [ ] **Step 1: Write failing command and preflight tests**

Assert exact iOS `simctl launch`, Android `am start`, Maestro values, emulator detection,
AICore absence, missing `gcloud`, missing GGUF, wrong size, and wrong SHA-256.

- [ ] **Step 2: Confirm red**

Run `npm test -- --runInBand __tests__/scripts/provider-runner.test.js`.

- [ ] **Step 3: Implement the simulator runner**

Inject command execution for tests. Validate platform and scenario before launch. Run the matching
Maestro flow and write `simulated-provider` evidence only after Maestro succeeds.

- [ ] **Step 4: Implement target preflight**

For Android, record model, OS, build, emulator flag, bootloader state when readable, AICore package,
and provider ability. Reject target evidence for a virtual device or missing AICore. Firebase mode
checks `gcloud`, project, and physical model description; run an external matrix only with
`--execute`.

For iOS, reject Simulator UDIDs as target evidence and record the device facts that `xcrun` gives.

- [ ] **Step 5: Implement checked GGUF placement**

Check configured filename, byte size, and SHA-256. Push through `/data/local/tmp`, copy with
`run-as com.airgap` into `files/models/`, check the copied checksum, and delete the temporary
device file.

- [ ] **Step 6: Check safe refusal on current virtual devices**

Run focused Jest. Run both preflights on the current simulator and emulator; both must refuse
`target-device`. Run Android model preparation without `--model`; it must exit nonzero.

- [ ] **Step 7: Commit**

Commit with `Add provider scenario and device runners`.

### Task 7: Documentation, template package, and release checks

**Files:**

- Create: `docs/provider-validation.md`
- Change: `docs/README.md`
- Change: `docs/recordings.md`
- Change: `README.md`
- Change: `PRODUCT-AUDIT.md`
- Change: `ROADMAP.md`
- Change: `CONTRIBUTING.md`
- Change: `packages/create-airgap-bot/test/packed-install.test.ts`
- Change: `.github/workflows/ci.yml`
- Change: `__tests__/ci-dependencies.test.js`

**Interfaces:**

- Consumes: all earlier commands and evidence classes.
- Produces: current maintainer guidance, checked template contents, and CI coverage.

- [ ] **Step 1: Add failing package and CI assertions**

Expect the packaged template to have the scenario manifest, native harness sources, provider tools,
and validation guide. Assert CI runs `providers:validate`, `providers:swift:test`, and the Android
harness unit test.

- [ ] **Step 2: Confirm red**

Run focused packed-template and CI tests.

- [ ] **Step 3: Update current documentation**

Explain the four provider evidence classes, separate capture-device class, exact commands, manual
Apple setting, Android emulator limit, optional GGUF placement, remote preflight, report promotion,
and facts each test cannot prove. Do not rebuild GIFs because visible behavior did not change.

- [ ] **Step 4: Add CI and rebuild the template**

Add deterministic validation and native parser tests to CI. Run
`npm run build-template --workspace create-airgap-bot`. Inspect the template diff and exclude local
or generated files.

- [ ] **Step 5: Run the full matrix**

```bash
npm test -- --runInBand
npm run lint
npx tsc --noEmit
npm run format:check
npm run docs:check
npm run journeys
npm run kb:validate
npm run server:test
npm run signing:test
npm run providers:validate
npm run providers:swift:test
(cd android && ./gradlew testDebugUnitTest assembleDebug assembleRelease)
xcodebuild -workspace ios/Airgap.xcworkspace -scheme Airgap   -sdk iphonesimulator -configuration Debug CODE_SIGNING_ALLOWED=NO build
xcodebuild -workspace ios/Airgap.xcworkspace -scheme Airgap   -sdk iphonesimulator -configuration Release CODE_SIGNING_ALLOWED=NO build
npm run recordings:validate
npm run cli:pack:test
npm run security:direct
```

Inspect Android Release APK and iOS Release app to confirm the manifest is absent.

- [ ] **Step 6: Review, stage, scan, and commit**

Keep protected untracked files unstaged. Stage explicit intended paths, run a staged secret scan,
and commit with `Add repeatable provider validation`.

- [ ] **Step 7: Push and check remote main**

Fetch before push and stop on divergence. Push `main`, compare local SHA with `git ls-remote` and
the GitHub branch API, then wait for CI, CodeQL, OpenSSF Scorecard, and Pages.
