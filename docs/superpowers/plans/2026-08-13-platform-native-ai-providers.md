# Platform-native Inference Providers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add policy-controlled Apple Foundation Models and Android ML Kit GenAI providers while preserving the downloaded model, cloud, and deterministic document-answer paths.

**Architecture:** A TypeScript provider contract and resolver own availability, ordering, fallback, cancellation, and run metadata. Thin React Native modules translate Apple Foundation Models and Android ML Kit GenAI into that contract. Existing generation services become providers. The app shows plain-language readiness and exact provenance without treating simulator recordings as physical-device proof.

**Tech Stack:** React Native 0.84, TypeScript 5.9, Jest, Swift with Foundation Models, Kotlin with ML Kit GenAI Prompt API 1.0.0-beta2, JSON Schema, Maestro, FFmpeg

**Spec:** `docs/superpowers/specs/2026-08-13-platform-native-ai-providers-design.md`

## Global Constraints

- Keep the iOS deployment target at 15.1 and gate Foundation Models with `#if canImport(FoundationModels)` plus `@available(iOS 26.0, *)`.
- Keep the Android minimum SDK at 24; Android AICore is eligible only on API 26 or newer.
- Recognize only `apple-foundation-models`, `android-aicore`, `llama-rn`, `cloud`, and `demo` provider IDs.
- Retrieve approved local documents before generation and keep tool choice, authentication, confirmation, and state-changing actions outside every model.
- Refresh provider capabilities for every request and never send customer text to telemetry by default.
- In `offline-only`, never select `cloud`; operator provider policy takes priority over a user routing preference.
- Keep downloaded `llama.rn`, authenticated cloud generation, and deterministic document formatting as fallbacks.
- Treat Android Prompt API as beta and enforce its under-4,000-token input bound. Document its age, medical, professional-advice, quota, foreground, and unlocked-bootloader restrictions.
- Label emulator and simulator footage accurately; only named physical-device checks count as native-provider release evidence.
- Preserve the existing untracked tight-recording scripts and GIF unless this plan intentionally incorporates their content.

---

### Task 1: Provider contract, policy, and resolver

**Files:**

- Create: `src/services/inference/types.ts`
- Create: `src/services/inference/providerResolver.ts`
- Test: `__tests__/inference-provider-resolver.test.ts`

**Interfaces:**

- Produces: `InferenceProviderId`, `ProviderState`, `ProviderFailureReason`, `InferenceCapabilities`, `InferenceRequest`, `InferenceResult`, `InferenceRunStats`, `InferenceProvider`, `ProviderPolicy`, `resolveProviderChain()`, and `generateWithProviders()`.
- `InferenceProvider.getCapabilities()` returns a fresh `Promise<InferenceCapabilities>`; `generate()` returns `Promise<InferenceResult>`; `cancel(requestId)` returns `Promise<void>`; `getLastRunStats()` returns `InferenceRunStats | null`.

- [x] **Step 1: Write the failing resolver tests**

```ts
test('uses ready providers in operator priority order', async () => {
  const result = await generateWithProviders(request, [second, first], policy);
  expect(result.providerId).toBe('apple-foundation-models');
});

test.each(FALLBACK_REASONS)('falls back after %s', async reason => {
  const result = await generateWithProviders(request, [failing(reason), demo], policy);
  expect(result.providerId).toBe('demo');
});

test('offline-only excludes cloud even when it is first', async () => {
  await expect(generateWithProviders(request, [cloud], offlinePolicy)).rejects.toMatchObject({
    reason: 'model_not_ready',
  });
});
```

- [x] **Step 2: Run the tests and confirm the resolver is missing**

Run: `npm test -- --runInBand __tests__/inference-provider-resolver.test.ts`

Expected: FAIL because `src/services/inference/providerResolver.ts` does not exist.

- [x] **Step 3: Implement the minimal contract and resolver**

```ts
export async function generateWithProviders(
  request: InferenceRequest,
  providers: InferenceProvider[],
  policy: ProviderPolicy,
): Promise<InferenceResult> {
  for (const provider of resolveProviderChain(providers, policy)) {
    const capabilities = await provider.getCapabilities();
    if (capabilities.state !== 'available') continue;
    try {
      return await provider.generate(request);
    } catch (error) {
      if (!isFallbackFailure(error)) throw error;
    }
  }
  throw new InferenceProviderError('model_not_ready', 'No permitted provider is ready');
}
```

Implement literal domain, platform, locale, enabled, priority, and routing-mode filters. Reject a second concurrent request to the same provider with `busy`, and forward cancellation to the active provider.

- [x] **Step 4: Run the resolver tests**

Run: `npm test -- --runInBand __tests__/inference-provider-resolver.test.ts`

Expected: PASS.

- [x] **Step 5: Commit the resolver**

```bash
git add src/services/inference/types.ts src/services/inference/providerResolver.ts __tests__/inference-provider-resolver.test.ts
git commit -m "Add policy-controlled inference resolution"
```

### Task 2: Configuration and backward compatibility

**Files:**

- Change: `src/config/loader.ts`
- Change: `src/config/validate.ts`
- Change: `airgap.schema.json`
- Change: `airgap.config.json`
- Change: `examples/airline/airgap.config.json`
- Change: `examples/banking/airgap.config.json`
- Change: `examples/electric-utility/airgap.config.json`
- Change: `examples/healthcare/airgap.config.json`
- Change: `examples/insurance/airgap.config.json`
- Change: `examples/telco/airgap.config.json`
- Change: `examples/water-utility/airgap.config.json`
- Test: `__tests__/config-validation.test.ts`

**Interfaces:**

- Consumes: `InferenceProviderId` from Task 1.
- Produces: `LlmProviderConfig`, `defaultProviderPolicy(mode, platform)`, and validated `llm.providers` entries with `enabled`, `priority`, `platform`, domain filters, `minimumOsVersion`, locale filters, `allowModelDownload`, and `allowCloudFallback`.

- [x] **Step 1: Add failing validation and compatibility tests**

```ts
test('rejects duplicate inference providers', () => {
  expect(() => validate(withProviders([apple, apple]))).toThrow('duplicate');
});

test('keeps legacy configurations on their current provider chain', () => {
  expect(defaultProviderPolicy('prefer-offline', 'ios').providers.map(item => item.id)).toEqual([
    'llama-rn',
    'cloud',
  ]);
});
```

Add literal tests for unknown IDs, an empty enabled chain, and explicit wrong-platform entries.

- [x] **Step 2: Run the validation tests and confirm they fail**

Run: `npm test -- --runInBand __tests__/config-validation.test.ts`

Expected: FAIL because provider-list validation and defaults do not exist.

- [x] **Step 3: Add typed config, schema constraints, and system-first examples**

```ts
export interface LlmProviderConfig {
  id: InferenceProviderId;
  enabled: boolean;
  priority: number;
  platform?: 'ios' | 'android' | 'all';
  allowedDomains?: string[];
  blockedDomains?: string[];
  minimumOsVersion?: string;
  locales?: string[];
  allowModelDownload?: boolean;
  allowCloudFallback?: boolean;
}
```

Keep configs without `providers` valid. Add `apple-foundation-models`, `android-aicore`, `llama-rn`, and `demo` to the sample chain; keep `cloud` disabled in the public demo config unless its existing authenticated endpoint is configured.

- [x] **Step 4: Run config and knowledge checks**

Run: `npm test -- --runInBand __tests__/config-validation.test.ts && npm run kb:validate`

Expected: PASS.

- [x] **Step 5: Commit configuration support**

```bash
git add src/config/loader.ts src/config/validate.ts airgap.schema.json airgap.config.json examples/airline/airgap.config.json examples/banking/airgap.config.json examples/electric-utility/airgap.config.json examples/healthcare/airgap.config.json examples/insurance/airgap.config.json examples/telco/airgap.config.json examples/water-utility/airgap.config.json __tests__/config-validation.test.ts
git commit -m "Configure ordered inference providers"
```

### Task 3: Existing providers, router, and audit metadata

**Files:**

- Create: `src/services/inference/existingProviders.ts`
- Change: `src/services/llmRouter.ts`
- Change: `src/services/orchestrator.ts`
- Change: `src/types/chat.ts`
- Change: `src/hooks/useChat.ts`
- Change: `src/components/chat/AnswerProvenance.tsx`
- Test: `__tests__/demo-mode.test.ts`
- Test: `__tests__/components/answer-provenance.test.tsx`

**Interfaces:**

- Consumes: provider contract and config policy from Tasks 1 and 2; existing `llmService`, `cloudLlmService`, and `demoLlmService`.
- Produces: `routeGeneration()` result `{text, source, providerId, modelIdentity, stats}`, async `generationAvailable()`, and audit fields `providerId` and `modelIdentity`.

- [x] **Step 1: Write failing routing and provenance tests**

```ts
expect(await routeGeneration('instructions', 'grounded prompt')).toMatchObject({
  source: 'local',
  providerId: 'demo',
  modelIdentity: 'document-formatter-v1',
});

expect(getProvenanceView({source: 'llm', providerId: 'apple-foundation-models'}).label).toBe(
  'Apple on-device model',
);
```

Add a test proving persisted message audit keeps both identity fields.

- [x] **Step 2: Run the focused tests and confirm the missing metadata**

Run: `npm test -- --runInBand __tests__/demo-mode.test.ts __tests__/components/answer-provenance.test.tsx`

Expected: FAIL because route and provenance results omit provider identity.

- [x] **Step 3: Wrap existing services and refactor routing**

```ts
const providers: InferenceProvider[] = [
  appleFoundationModelsProvider,
  androidAicoreProvider,
  llamaProvider,
  cloudProvider,
  demoProvider,
];
```

Use the resolver for every generation. Replace synchronous availability guards in the orchestrator with `await generationAvailable()`. Copy provider and model identity into successful LLM/tool audit objects and leave non-model responses unchanged.

- [x] **Step 4: Run routing, chat, and provenance tests**

Run: `npm test -- --runInBand __tests__/demo-mode.test.ts __tests__/llm-service.test.ts __tests__/components/answer-provenance.test.tsx`

Expected: PASS.

- [x] **Step 5: Commit router integration**

```bash
git add src/services/inference/existingProviders.ts src/services/llmRouter.ts src/services/orchestrator.ts src/types/chat.ts src/hooks/useChat.ts src/components/chat/AnswerProvenance.tsx __tests__/demo-mode.test.ts __tests__/components/answer-provenance.test.tsx
git commit -m "Route generation through provider contracts"
```

### Task 4: Apple Foundation Models bridge

**Files:**

- Create: `src/services/inference/appleFoundationModelsProvider.ts`
- Create: `ios/Airgap/AppleFoundationModelsModule.swift`
- Create: `ios/Airgap/AppleFoundationModelsModule.m`
- Change: `ios/Airgap.xcodeproj/project.pbxproj`
- Test: `__tests__/apple-foundation-models-provider.test.ts`

**Interfaces:**

- Consumes: `InferenceProvider` and normalized errors from Task 1.
- Produces: `appleFoundationModelsProvider`, native methods `getCapabilities`, `generate`, and `cancel`, and `AirgapInferenceToken` events keyed by `requestId`.

- [x] **Step 1: Write failing adapter behavior tests**

```ts
test('maps an ineligible Apple device without sending a prompt', async () => {
  native.getCapabilities.mockResolvedValue({state: 'unavailable', reason: 'deviceNotEligible'});
  await expect(provider.getCapabilities()).resolves.toMatchObject({
    state: 'unavailable',
    reason: 'unsupported_device',
  });
  expect(native.generate).not.toHaveBeenCalled();
});
```

Add tests for `appleIntelligenceNotEnabled`, `modelNotReady`, streaming snapshots converted to deltas, cancellation, and context errors.

- [x] **Step 2: Run the Apple tests and confirm the adapter is missing**

Run: `npm test -- --runInBand __tests__/apple-foundation-models-provider.test.ts`

Expected: FAIL because the provider module does not exist.

- [x] **Step 3: Implement the TypeScript and Swift bridge**

```swift
#if canImport(FoundationModels)
import FoundationModels
#endif

@objc(AppleFoundationModelsModule)
final class AppleFoundationModelsModule: RCTEventEmitter {
  @objc func getCapabilities(_ resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    if #available(iOS 26.0, *) {
      resolve(capabilities(for: SystemLanguageModel.default))
    } else {
      resolve(["state": "unavailable", "reason": "unsupportedOs"])
    }
  }
}
```

Create a new `LanguageModelSession(instructions:)` per request. Iterate `streamResponse(to:)`, emit only the suffix added since the preceding snapshot, store the active `Task` by request ID, and clear it after success, failure, or cancellation. Report `contextSize` and a stable OS/model label when the framework exposes them.

- [x] **Step 4: Run the Apple adapter test and compile for an iOS simulator**

Run: `npm test -- --runInBand __tests__/apple-foundation-models-provider.test.ts`

Run: `xcodebuild -workspace ios/Airgap.xcworkspace -scheme Airgap -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build`

Expected: both commands PASS; older simulator runtimes report `unsupported_os` instead of loading the framework.

- [x] **Step 5: Commit Apple support**

```bash
git add src/services/inference/appleFoundationModelsProvider.ts ios/Airgap/AppleFoundationModelsModule.swift ios/Airgap/AppleFoundationModelsModule.m ios/Airgap.xcodeproj/project.pbxproj __tests__/apple-foundation-models-provider.test.ts
git commit -m "Add Apple on-device inference"
```

### Task 5: Android ML Kit GenAI bridge

**Files:**

- Create: `src/services/inference/androidAicoreProvider.ts`
- Create: `android/app/src/main/java/com/airgap/inference/AndroidAicoreModule.kt`
- Create: `android/app/src/main/java/com/airgap/inference/AndroidAicorePackage.kt`
- Change: `android/app/src/main/java/com/airgap/MainApplication.kt`
- Change: `android/app/build.gradle`
- Test: `__tests__/android-aicore-provider.test.ts`

**Interfaces:**

- Consumes: `InferenceProvider` and normalized errors from Task 1.
- Produces: `androidAicoreProvider`, native methods `getCapabilities`, `download`, `warmup`, `generate`, and `cancel`, plus `AirgapInferenceToken` and `AirgapInferenceDownload` events keyed by request ID.

- [x] **Step 1: Write failing Android adapter tests**

```ts
test.each([
  ['UNAVAILABLE', 'unavailable'],
  ['DOWNLOADABLE', 'downloadable'],
  ['DOWNLOADING', 'downloading'],
  ['AVAILABLE', 'available'],
])('maps %s feature status', async (nativeState, state) => {
  native.getCapabilities.mockResolvedValue({state: nativeState});
  await expect(provider.getCapabilities()).resolves.toMatchObject({state});
});
```

Add tests for API 24/25, streaming, download progress, cancellation, quota, foreground, context, and setup failures.

- [x] **Step 2: Run the Android tests and confirm the adapter is missing**

Run: `npm test -- --runInBand __tests__/android-aicore-provider.test.ts`

Expected: FAIL because the provider module does not exist.

- [x] **Step 3: Implement the TypeScript and Kotlin bridge**

```kotlin
private val model by lazy { Generation.getClient() }

@ReactMethod
fun getCapabilities(promise: Promise) = scope.launch {
  val state = if (Build.VERSION.SDK_INT < 26) "UNSUPPORTED_OS" else model.checkStatus().name
  promise.resolve(Arguments.createMap().apply { putString("state", state) })
}
```

Add `implementation("com.google.mlkit:genai-prompt:1.0.0-beta2")`. Collect download and generation flows on a coroutine scope. Emit incremental text. Cap the joint instructions and grounded prompt below 4,000 tokens with the API token count. Cancel jobs by request ID and normalize `GenAiException` outcomes. Register `AndroidAicorePackage()` in `MainApplication`.

- [x] **Step 4: Run Android tests and compile the debug app**

Run: `npm test -- --runInBand __tests__/android-aicore-provider.test.ts`

Run: `JAVA_HOME=/opt/homebrew/opt/openjdk@17 ./gradlew app:assembleDebug` from `android/`.

Expected: both commands PASS; unsupported emulators report an unavailable state without crashing.

- [x] **Step 5: Commit Android support**

```bash
git add src/services/inference/androidAicoreProvider.ts android/app/src/main/java/com/airgap/inference/AndroidAicoreModule.kt android/app/src/main/java/com/airgap/inference/AndroidAicorePackage.kt android/app/src/main/java/com/airgap/MainApplication.kt android/app/build.gradle __tests__/android-aicore-provider.test.ts
git commit -m "Add Android system inference"
```

### Task 6: Provider readiness interface

**Files:**

- Create: `src/hooks/useInferenceProviders.ts`
- Create: `src/components/onboarding/ProviderSetupCard.tsx`
- Create: `src/components/settings/ProviderStatusCard.tsx`
- Change: `src/screens/OnboardingScreen.tsx`
- Change: `src/screens/SettingsScreen.tsx`
- Change: `src/components/common/OperatingState.tsx`
- Test: `__tests__/components/provider-setup-card.test.tsx`
- Test: `__tests__/components/provider-status-card.test.tsx`

**Interfaces:**

- Consumes: current capabilities and download actions from Tasks 3 through 5.
- Produces: `useInferenceProviders()`, `getProviderSetupView()`, and `getProviderStatusView()`.

- [x] **Step 1: Write failing state-to-copy and accessibility tests**

```ts
expect(getProviderSetupView({state: 'available', providerId: 'apple-foundation-models'})).toEqual(
  expect.objectContaining({title: 'System AI ready', action: 'Continue'}),
);

expect(getProviderSetupView({state: 'downloadable', providerId: 'android-aicore'})).toEqual(
  expect.objectContaining({title: 'System AI needs setup', action: 'Download system AI'}),
);
```

Cover all four onboarding states and provider reason text. Render cards and assert named buttons, roles, hints, progress values, and no raw runtime jargon in primary copy.

- [x] **Step 2: Run the component tests and confirm the components are missing**

Run: `npm test -- --runInBand __tests__/components/provider-setup-card.test.tsx __tests__/components/provider-status-card.test.tsx`

Expected: FAIL because the provider UI does not exist.

- [x] **Step 3: Implement the readiness hook and cards**

Use the existing navy, cyan, status colors, type scale, radius, and spacing tokens. Make the signature element a compact ordered provider rail: each row has one numbered position, plain provider name, readiness text, and a single status mark. Keep technical identity and policy reasons in Settings; onboarding only explains the next action.

```text
AI for this device
● 1  Apple on-device model     Ready
○ 2  Downloaded Airgap model   Optional
○ 3  Document answers          Always available
```

Respect safe-area, dynamic type, screen readers, reduced motion, 44-point touch targets, and current dark-mode tokens.

- [x] **Step 4: Run component and screen tests**

Run: `npm test -- --runInBand __tests__/components __tests__/screens`

Expected: PASS.

- [x] **Step 5: Capture and inspect onboarding and settings screenshots**

Run the app on available iOS Simulator and Android Emulator targets. Capture both screens under `tmp/ui-review/<commit>/`. Inspect clipping, contrast, hierarchy, duplicate copy, and provider state. Fix visual defects and rerun Step 4.

- [x] **Step 6: Commit the provider interface**

```bash
git add src/hooks/useInferenceProviders.ts src/components/onboarding/ProviderSetupCard.tsx src/components/settings/ProviderStatusCard.tsx src/screens/OnboardingScreen.tsx src/screens/SettingsScreen.tsx src/components/common/OperatingState.tsx __tests__/components/provider-setup-card.test.tsx __tests__/components/provider-status-card.test.tsx
git commit -m "Explain on-device provider readiness"
```

### Task 7: Recording evidence and kept GIF pipeline

**Files:**

- Change: `scripts/lib/recordings.js`
- Change: `scripts/record-demo.mjs`
- Change: `scripts/record-industries.mjs`
- Change: `scripts/build-readme-gif.mjs`
- Change: `scripts/recording-flows/demo-android.yaml`
- Change: `scripts/recording-flows/demo-ios.yaml`
- Change: `demo/recordings.json`
- Change when recording succeeds: `demo/airgap-demo.gif`
- Change when recording succeeds: `demo/airgap-demo-ios.gif`
- Change when both recordings succeed: `demo/airgap-readme-side-by-side.gif`
- Test: `__tests__/scripts/validate-recordings.test.js`

**Interfaces:**

- Produces: recording manifest schema version 2 with needed `providerId`, `modelIdentity`, `evidenceClass`, and `captureCommand` fields.
- `evidenceClass` is one of `emulator`, `simulator`, or `physical-device`; joint recordings combine the two actual classes in a sorted array.

- [x] **Step 1: Add failing metadata and truthfulness tests**

```js
expect(() => validateRecording(record({providerId: undefined}))).toThrow(
  'recording_provider_missing',
);
expect(() =>
  validateRecording(record({device: 'Android Emulator', evidenceClass: 'physical-device'})),
).toThrow('recording_evidence_class_invalid');
```

Add failures for a missing model identity, missing capture command, and schema version 1.

- [x] **Step 2: Run recording tests and confirm the manifest accepts incomplete evidence**

Run: `npm test -- --runInBand __tests__/scripts/validate-recordings.test.js`

Expected: FAIL because schema version 2 and provider evidence fields are not enforced.

- [x] **Step 3: Implement evidence metadata and update existing records**

Set current demo recordings to `providerId: "demo"`, `modelIdentity: "document-formatter-v1"`, and the accurate simulator/emulator class. Make `record-demo.mjs` accept `--provider`, `--model-identity`, and `--evidence-class`; derive the default class from the target facts and save the full repository-relative capture command.

- [x] **Step 4: Validate the kept recording pipeline**

Run: `npm test -- --runInBand __tests__/scripts/validate-recordings.test.js && npm run recordings:validate`

Expected: PASS.

- [x] **Step 5: Detect connected capture targets and rerecord what the checks prove**

Run: `adb devices -l`

Run: `xcrun simctl list devices booted`

Run: `xcrun xctrace list devices`

If working simulator/emulator targets exist, record fresh demo GIFs from the checked application commit and rebuild the README GIF. If eligible physical devices exist and the native providers pass their checks, record those providers with `evidenceClass: physical-device`. If no eligible physical device exists, mark the native-provider release status as not checked. Do not relabel simulator footage.

- [x] **Step 6: Inspect generated GIF loops and validate exact media facts**

Run: `npm run recordings:validate`

Render contact sheets under `tmp/recordings/<commit>/`, inspect the first, middle, and final frames, set `loopReviewed: true` only after review, and rerun validation.

- [x] **Step 7: Commit kept recording evidence**

```bash
git add scripts/lib/recordings.js scripts/record-demo.mjs scripts/record-industries.mjs scripts/build-readme-gif.mjs scripts/recording-flows/demo-android.yaml scripts/recording-flows/demo-ios.yaml demo/recordings.json __tests__/scripts/validate-recordings.test.js
git add demo/airgap-demo.gif demo/airgap-demo-ios.gif demo/airgap-readme-side-by-side.gif
git commit -m "Record provider-aware demo evidence"
```

Only stage GIF paths that the recording process regenerated and checked.

### Task 8: README, deployment, and release boundaries

**Files:**

- Change: `README.md`
- Change: `DEPLOYMENT.md`
- Change: `ROADMAP.md`
- Change: `docs/hybrid-llm-design.md`

**Interfaces:**

- Consumes: actual checked behavior and recording metadata from Tasks 1 through 7.
- Produces: public setup, fallback, support, privacy, terms, evidence, and troubleshooting instructions matching the checked code.

- [x] **Step 1: Rewrite the README around the first successful offline answer**

Add a short product definition, a three-command quick start, and the fresh iOS simulator GIF. Add an exact provider support table, fallback order, four setup states, privacy boundary, operator-policy example, device-evidence table, known limitations, and documentation links. State that system models phrase retrieved company information and are not knowledge sources.

- [x] **Step 2: Update deployment and architecture guidance**

Document Xcode 26/iOS 26 build requirements and Android API 26/ML Kit beta2 setup. Cover platform eligibility, model download, foreground and quota behavior, locale and domain policy, cloud authentication, and failure reasons. Add the physical-device test procedure, prompt/model drift evaluation, and rollback by disabling a provider entry.

- [x] **Step 3: Move provider work to the current roadmap section**

Move Apple Foundation Models and Android AICore from Later to Now. Preserve LiteRT-LM benchmarking as later work. List physical-device evaluation and an operator integration as release gates.

- [x] **Step 4: Check public prose and formatting**

Run the prose checker with `--file <path> --mode prose` for `README.md`, `DEPLOYMENT.md`, `ROADMAP.md`, `docs/hybrid-llm-design.md`, and the design specification.

Run: `npx prettier --check README.md DEPLOYMENT.md ROADMAP.md docs/hybrid-llm-design.md docs/superpowers/specs/2026-08-13-platform-native-ai-providers-design.md docs/superpowers/plans/2026-08-13-platform-native-ai-providers.md`

Expected: both commands PASS.

- [x] **Step 5: Commit public documentation**

```bash
git add README.md DEPLOYMENT.md ROADMAP.md docs/hybrid-llm-design.md
git commit -m "Document native provider deployment"
```

### Task 9: Release-candidate verification and remote publication

**Files:**

- Inspect: all files changed since `origin/main`
- Do not change user-owned untracked files unless a failing check proves they are in the published path.

**Interfaces:**

- Produces: a checked feature branch on the configured remote and a final evidence report with physical-device gaps stated explicitly.

- [ ] **Step 1: Run the complete JavaScript and content checks**

Run: `npm test -- --runInBand`

Run: `npm run lint && npm run format:check && npx tsc --noEmit && npm run kb:validate && npm run recordings:validate && npm run journeys && npm run server:test && npm run signing:test && npm run cli:pack:test && npm run security:direct`

Expected: all commands PASS.

- [ ] **Step 2: Run native compilation checks**

Run: `xcodebuild -workspace ios/Airgap.xcworkspace -scheme Airgap -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build`

Run: `JAVA_HOME=/opt/homebrew/opt/openjdk@17 ./gradlew app:assembleDebug` from `android/`.

Expected: both commands PASS.

- [ ] **Step 3: Review security, scope, and public claims**

Run the security-scan and diff-review skills. Inspect `git diff --check`, `git status --short`, `git diff --stat origin/main...HEAD`, and the complete `origin/main...HEAD` diff. Confirm no secrets, local absolute paths, generated build products, false device claims, or unrelated user files are staged.

- [ ] **Step 4: Commit any final checked corrections**

List the corrected paths with `git diff --name-only`. Stage each listed path explicitly, inspect the staged diff, and commit with `Finish native provider release candidate`. Skip this commit if the tree has no intended tracked changes.

- [ ] **Step 5: Push the feature branch**

Run: `git push -u origin platform-native-ai`

Expected: the remote branch points at the locally checked HEAD. Do not merge to `main` without a new explicit instruction.
