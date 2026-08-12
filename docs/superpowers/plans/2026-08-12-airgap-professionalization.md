# Airgap Professionalization Build Plan

> **For agentic workers.** Use the Superpowers subagent-driven-development or executing-plans skill. Follow tasks in order and track each checkbox.

**Goal.** Make Airgap a secure, clear, tested open-source starter kit for offline-first mobile support.

**Architecture.** Start services after secure storage opens. Keep mobile connectors behind token and file adapters. Keep each user-visible state tied to stored runtime facts. Package the app template inside the CLI tarball.

**Tech Stack.** React Native 0.84, TypeScript 5.9, Jest 29, MMKV 4, React Native Keychain, TweetNaCl, Node 22, HTML, CSS, and `ffmpeg`.

## Global Constraints

- Keep the root npm package private.
- Support Android and iOS.
- Keep demo mode free of model downloads and network calls.
- Use Ed25519 for every downloaded knowledge bundle.
- Reject a bundle when its length, hash, signature, key, or schema fails.
- Use an installed asynchronous token source for REST, sync, and cloud requests.
- Keep queue retries at three unless the operator sets another value.
- Preserve the last valid knowledge bundle after each sync failure.
- Keep the existing untracked GIF and two tight recording scripts unchanged.
- Store source recordings under `tmp/recordings/<commit>/`.
- Use fresh Android Emulator and iOS Simulator sessions for release GIFs.
- Do not make regulatory compliance or physical-device speed claims without evidence.
- Do not publish, tag, push, or change repository settings before all local gates pass.

## Task 1. Secure storage opens before application services

**Files**

- Create `src/services/secureStorage.ts`
- Create `__tests__/secure-storage.test.ts`
- Change `src/App.tsx`
- Change `src/services/modelManager.ts`
- Change `src/services/offlineQueue.ts`
- Change `src/services/syncService.ts`
- Change `src/services/telemetry.ts`
- Change `src/services/llmRouter.ts`
- Change `package.json`
- Change `package-lock.json`
- Remove `src/services/secretStore.ts`

**Interfaces**

- `initializeSecureStorage(labels?: readonly string[]): Promise<void>` opens all named keys.
- `getSecureStore(id: SecureStoreId): MMKV` returns a keyed store after startup.
- `clearSecureStore(id: SecureStoreId): void` clears one user-data store.
- `resetSecureStorageForTests(): void` clears module state in Jest only.

- [x] **Step 1. Write failing secure-storage tests**

```ts
it('rejects store access before startup', () => {
  expect(() => getSecureStore('offline-queue')).toThrow('secure_storage_not_ready');
});

it('stores a random key in the platform key store', async () => {
  await initializeSecureStorage(['offline-queue']);
  expect(keychain.setGenericPassword).toHaveBeenCalledWith(
    'airgap',
    expect.stringMatching(/^[a-f0-9]{64}$/),
    expect.objectContaining({service: 'airgap.storage.offline-queue'}),
  );
});

it('fails closed when the platform key store fails', async () => {
  keychain.getGenericPassword.mockRejectedValue(new Error('locked'));
  await expect(initializeSecureStorage(['offline-queue'])).rejects.toThrow(
    'secure_storage_unavailable',
  );
});
```

- [x] **Step 2. Run the focused test and check the missing module fails**

Run. `npm test -- --runInBand __tests__/secure-storage.test.ts`

Expected. Jest cannot resolve `src/services/secureStorage`.

- [x] **Step 3. Add Keychain-backed storage startup**

Use `react-native-keychain` version `10.0.0`. Make 32 random bytes with
`crypto.getRandomValues`. Do not use `Math.random` or an install-derived key.

```ts
export type SecureStoreId =
  | 'app-state'
  | 'conversation'
  | 'kb-sync'
  | 'model-manager'
  | 'offline-queue'
  | 'telemetry-buffer'
  | 'user-prefs';

export async function initializeSecureStorage(
  labels: readonly SecureStoreId[] = SECURE_STORE_IDS,
): Promise<void>;

export function getSecureStore(id: SecureStoreId): MMKV;
```

- [x] **Step 4. Move every user-data MMKV store behind secure startup**

App startup waits for `initializeSecureStorage()` before it reads onboarding
state or starts sync, telemetry, model, or navigation work.

- [x] **Step 5. Run focused and full checks**

Run. `npm test -- --runInBand __tests__/secure-storage.test.ts`

Run. `npm test -- --runInBand`

Run. `npm run lint`

## Task 2. Tokens and the reference server protect network requests

**Files**

- Create `src/services/authProvider.ts`
- Create `__tests__/auth-provider.test.ts`
- Create `__tests__/backend-connector.test.ts`
- Create `__tests__/server.test.mjs`
- Change `src/services/backendConnector.ts`
- Change `src/services/cloudLlmService.ts`
- Change `server/index.mjs`
- Change `server/README.md`
- Change `airgap.schema.json`
- Change `src/config/loader.ts`
- Change `src/config/validate.ts`
- Change `__tests__/config-validation.test.ts`

**Interfaces**

- `installAccessTokenProvider(provider: AccessTokenProvider): void` installs one source.
- `getAccessToken(audience: string): Promise<string>` gets a short-lived token.
- `RestBackendConnector` asks for a token on every request.
- `createAirgapServer(options: ServerOptions)` returns a server for tests and CLI use.

- [x] **Step 1. Write failing token and connector tests**

```ts
it('gets a new token for each request', async () => {
  installAccessTokenProvider({
    getAccessToken: jest.fn().mockResolvedValueOnce('one').mockResolvedValueOnce('two'),
  });
  await connector.checkOutage();
  await connector.checkOutage();
  expect(fetch).toHaveBeenNthCalledWith(
    1,
    expect.any(String),
    expect.objectContaining({headers: expect.objectContaining({Authorization: 'Bearer one'})}),
  );
  expect(fetch).toHaveBeenNthCalledWith(
    2,
    expect.any(String),
    expect.objectContaining({headers: expect.objectContaining({Authorization: 'Bearer two'})}),
  );
});
```

- [x] **Step 2. Check both focused tests fail for the missing token source**

Run. `npm test -- --runInBand __tests__/auth-provider.test.ts __tests__/backend-connector.test.ts`

- [x] **Step 3. Remove stored bearer secrets and unused connector fields**

Allow only `mock` and `rest` backend types. Replace OAuth fields, endpoint maps,
and cloud bearer strings with `auth.type: "provider"`.

- [x] **Step 4. Write failing server request tests**

```js
test('rejects a missing bearer token', async () => {
  const response = await fetch(base + '/api/v1/sync/kb');
  assert.equal(response.status, 401);
});

test('limits one client after the set request count', async () => {
  const responses = await sendAuthorizedRequests(4);
  assert.equal(responses.at(-1).status, 429);
});
```

- [x] **Step 5. Add timing-safe bearer checks, limits, and rate headers**

Use `BFF_AUTH_TOKEN`, a 256 KB body limit, and a per-client fixed window. Keep
`/healthz` public. Make other routes return `401`, `413`, or `429` as needed.

- [x] **Step 6. Run server, config, connector, lint, and full tests**

Run. `node --test __tests__/server.test.mjs`

Run. `npm test -- --runInBand __tests__/auth-provider.test.ts __tests__/backend-connector.test.ts __tests__/config-validation.test.ts`

Run. `npm run lint`

## Task 3. Knowledge sync checks exact signed bytes

**Files**

- Create `src/services/bundleVerifier.ts`
- Create `__tests__/bundle-verifier.test.ts`
- Change `src/services/syncService.ts`
- Change `src/services/backendConnector.ts`
- Change `server/index.mjs`
- Change `airgap.schema.json`
- Change `airgap.config.json`
- Change `docs/sync-architecture.md`
- Change `package.json`
- Change `package-lock.json`

**Interfaces**

- `BundleManifest` has algorithm, encoding, length, hash, version, key ID, and URL.
- `verifyBundle(input: BundleVerificationInput): Promise<VerifiedBundle>` checks all fields.
- The server signs the exact bytes returned by the download route.

- [x] **Step 1. Write failing Ed25519 tests with fixed key material**

```ts
it('accepts the exact signed bytes', async () => {
  await expect(verifyBundle(validFixture)).resolves.toMatchObject({version: '2'});
});

it.each(['length', 'sha256', 'signature', 'keyId', 'schema'])('rejects a bad %s', async field =>
  expect(verifyBundle(change(validFixture, field))).rejects.toThrow(`bundle_${field}_invalid`),
);
```

- [x] **Step 2. Check the focused test fails before code changes**

Run. `npm test -- --runInBand __tests__/bundle-verifier.test.ts`

- [x] **Step 3. Add TweetNaCl verification and strict manifest fields**

Use `tweetnacl` version `1.0.3`. Decode base64 without Node `Buffer`. Accept only
`Ed25519`, `base64`, a 32-byte public key, a 64-byte signature, and known key IDs.

- [x] **Step 4. Route downloaded bytes through the verifier before file swap**

Remove each partial file after a failed check. Keep the current and earlier
files unchanged until all checks and knowledge parsing pass.

- [x] **Step 5. Make the server manifest match the client contract**

The server emits `algorithm`, `signatureEncoding`, `byteLength`, `sha256`,
`version`, `keyId`, `url`, `publishedAt`, and `signature`.

- [x] **Step 6. Run signature, sync, server, knowledge, and lint checks**

Run. `npm test -- --runInBand __tests__/bundle-verifier.test.ts __tests__/sync-service.test.ts __tests__/sync-integration.test.ts`

Run. `node --test __tests__/server.test.mjs`

Run. `npm run kb:validate`

Run. `npm run lint`

## Task 4. Queue, model, conversation, and deletion states stay truthful

**Files**

- Create `src/services/conversationStore.ts`
- Create `src/services/dataDeletionService.ts`
- Create `src/services/actionQueueTypes.ts`
- Create `__tests__/conversation-store.test.ts`
- Create `__tests__/data-deletion.test.ts`
- Create `__tests__/offline-queue.test.ts`
- Create `__tests__/model-manager.test.ts`
- Create `__tests__/llm-service.test.ts`
- Change `src/hooks/useChat.ts`
- Change `src/services/orchestrator.ts`
- Change `src/services/offlineQueue.ts`
- Change `src/services/backendConnector.ts`
- Change `src/services/modelManager.ts`
- Change `src/services/llmService.ts`
- Change `src/services/telemetry.ts`
- Change `src/types/chat.ts`

**Interfaces**

- `ConversationStore` saves visible messages and prompt turns in one snapshot.
- `QueueRecord` has pending, processing, failed, and completed states.
- `retry(id)`, `remove(id)`, and `subscribe(listener)` support the outbox.
- `deleteAllUserData()` runs every registered clearing operation and returns results.

- [x] **Step 1. Write failing queue state tests**

```ts
it('marks a backend error as failed', async () => {
  connector.executeAction.mockRejectedValue(new Error('down'));
  const [result] = await queue.processQueue();
  expect(result.action.status).toBe('failed');
  expect(result.action.errorCode).toBe('backend_error');
});

it('does not retry a failed record in the same cycle', async () => {
  await queue.processQueue();
  expect(connector.executeAction).toHaveBeenCalledTimes(1);
});
```

- [x] **Step 2. Write failing conversation, deletion, model, and timeout tests**

Test Date restoration, context clearing, each store clearing, file restart,
file length checks, progress clamping, and timeout cleanup with fake timers.

- [x] **Step 3. Run the focused tests and check each behavior fails**

Run. `npm test -- --runInBand __tests__/offline-queue.test.ts __tests__/conversation-store.test.ts __tests__/data-deletion.test.ts __tests__/model-manager.test.ts __tests__/llm-service.test.ts`

- [x] **Step 4. Add queue records, receipts, and idempotency keys**

Send the queue record ID in `Idempotency-Key`. Do not turn errors into mock
success. Stop retries at `config.queue.maxRetries ?? 3`.

- [x] **Step 5. Join visible messages and prompt context in one secure snapshot**

`useChat` restores the snapshot. The orchestrator reads and writes the same
snapshot. Clear actions update both parts.

- [x] **Step 6. Restart unsafe model downloads and clear generation timers**

Remove an old partial file before each download. Check every final file against
the exact byte length and hash. Clamp progress between zero and one.

- [x] **Step 7. Register every data store and file with the deletion service**

Clear conversations, queue, telemetry, sync, model records, model files,
preferences, and onboarding state. Return one result per operation.

- [x] **Step 8. Run focused, full, type, and lint checks**

Run. `npm test -- --runInBand __tests__/offline-queue.test.ts __tests__/conversation-store.test.ts __tests__/data-deletion.test.ts __tests__/model-manager.test.ts __tests__/llm-service.test.ts`

Run. `npx tsc --noEmit`

Run. `npm test -- --runInBand`

Run. `npm run lint`

## Task 5. The mobile interface shows operating facts and recovery actions

**Files**

- Create `src/components/common/OperatingState.tsx`
- Create `src/components/chat/AnswerProvenance.tsx`
- Create `src/components/chat/ActionReceipt.tsx`
- Create `src/screens/OutboxScreen.tsx`
- Create `src/hooks/useReducedMotion.ts`
- Create `__tests__/components/operating-state.test.tsx`
- Create `__tests__/components/answer-provenance.test.tsx`
- Create `__tests__/components/action-receipt.test.tsx`
- Create `__tests__/components/outbox-screen.test.tsx`
- Change `src/App.tsx`
- Change `src/screens/ChatScreen.tsx`
- Change `src/screens/OnboardingScreen.tsx`
- Change `src/screens/SettingsScreen.tsx`
- Change `src/components/chat/MessageBubble.tsx`
- Change `src/components/chat/InputToolbar.tsx`
- Change `src/components/chat/QuickReplies.tsx`
- Change `src/constants/theme.ts`

**Interfaces**

- `OperatingState` shows Demo, Local, Cloud, or Offline.
- `AnswerProvenance` shows the answer source, knowledge version, and sources.
- `ActionReceipt` shows pending, failed, retrying, and completed records.
- `OutboxScreen` lists records and calls retry or remove.

- [x] **Step 1. Write failing component behavior tests**

```tsx
it('shows a failed action with Retry and Remove', () => {
  const view = renderer.create(<ActionReceipt record={failedRecord} />).root;
  expect(view.findByProps({accessibilityLabel: 'Retry action'})).toBeTruthy();
  expect(view.findByProps({accessibilityLabel: 'Remove action'})).toBeTruthy();
});
```

- [x] **Step 2. Check the new component imports fail**

Run. `npm test -- --runInBand __tests__/components/operating-state.test.tsx __tests__/components/answer-provenance.test.tsx __tests__/components/action-receipt.test.tsx __tests__/components/outbox-screen.test.tsx`

- [x] **Step 3. Apply the field-support console design system**

Use deep navy `#0B1F33`, cyan `#0E7490`, pressed cyan `#155E75`, orange
`#C2410C`, canvas `#F6F8FA`, and white surfaces. Keep system body text and use
the platform monospaced face for runtime facts.

```text
+----------------------------------+
| Airgap support      DEMO  Outbox |
| Offline knowledge ready          |
+----------------------------------+
| Answer                           |
|  Local knowledge  v2026.08       |
|  Source rail and documents       |
|                                  |
|  Action receipt  Pending         |
+----------------------------------+
| Suggested actions wrap           |
| Ask a support question      Send |
+----------------------------------+
```

The provenance rail is the signature element. Remove decorative controls that
do not state operating facts. Keep one orange treatment for warnings only.

- [x] **Step 4. Replace onboarding claims with three clear paths**

Show Try Offline Demo, Install Local AI, and Use Set-Up Service. Hide the service
path until a token source and cloud mode exist. State exact model size and checks.

- [x] **Step 5. Add outbox and dynamic privacy controls**

Link the header to Outbox. Connect Retry and Remove to queue methods. Build
privacy copy from local, cloud, sync, and telemetry facts. Connect data deletion.

- [x] **Step 6. Respect reduced motion and large text**

Skip entrance, cursor, and floating-button animations when the platform setting
turns reduced motion on. Keep all controls at least 44 by 44 points.

- [x] **Step 7. Run component, full, type, and lint checks**

Run. `npm test -- --runInBand __tests__/components`

Run. `npx tsc --noEmit`

Run. `npm test -- --runInBand`

Run. `npm run lint`

## Task 6. The CLI, dependencies, and CI produce a fixed release candidate

**Files**

- Create `packages/create-airgap-bot/scripts/build-template.mjs`
- Create `packages/create-airgap-bot/test/packed-install.test.ts`
- Create `scripts/check-direct-advisories.mjs`
- Create `.github/dependabot.yml`
- Create `.github/workflows/codeql.yml`
- Create `.github/workflows/scorecard.yml`
- Create `.github/workflows/dependency-review.yml`
- Change `packages/create-airgap-bot/src/scaffold.ts`
- Change `packages/create-airgap-bot/package.json`
- Change `packages/create-airgap-bot/.npmignore`
- Change `package.json`
- Change `package-lock.json`
- Change `.github/workflows/ci.yml`
- Change `.github/workflows/publish-create-airgap-bot.yml`
- Change `android/app/build.gradle`
- Change `ios/Airgap.xcodeproj/project.pbxproj`

**Interfaces**

- `build-template.mjs` copies one fixed allowlist into `packages/create-airgap-bot/template`.
- `scaffold()` copies only the packaged template when `sourceDir` is absent.
- `check-direct-advisories.mjs` fails on a direct high or critical advisory.

- [x] **Step 1. Write a failing packaged-template test**

```ts
it('scaffolds with network access disabled', async () => {
  global.fetch = jest.fn(() => {
    throw new Error('network called');
  });
  await scaffold({botName: 'field-help', template: 'water-utility', targetDir});
  expect(global.fetch).not.toHaveBeenCalled();
  expect(readConfig(targetDir).brand.name).toBe('Clearwater Water District');
});
```

- [x] **Step 2. Check the test fails because the CLI downloads `main`**

Run. `npm test --workspace create-airgap-bot -- --runInBand`

- [x] **Step 3. Build and copy the packaged allowlist**

Include application source, native projects, assets, examples, schemas, scripts,
and package files. Exclude Git data, demos, site files, tests, plans, and secrets.

- [x] **Step 4. Remove `tar` and all mutable source downloads**

Remove tarball code, `tar`, and archive extraction. Use `import.meta.url` or
`__dirname` to find the installed `template` directory.

- [x] **Step 5. Align candidate versions and block root publication**

Set root, Android, iOS, and CLI marketing versions to `0.2.0`. Set root
`private: true`. Keep the CLI package public.

- [x] **Step 6. Update safe direct dependencies and record upstream findings**

Use current patch releases that keep React Native 0.84 compatibility. Do not
force incompatible transitive versions. Make the direct-advisory check list each
unfixed upstream chain in release evidence.

- [x] **Step 7. Expand CI checks**

Add format, type, unit, journey, knowledge, server, CLI pack, Android debug,
recording validation, direct advisory, coverage, dependency review, CodeQL,
Dependabot, and Scorecard files. Keep iOS build on a macOS runner.

- [x] **Step 8. Run package and dependency checks**

Run. `npm run cli:pack:test`

Run. `npm run security:direct`

Run. `npm pack --workspace create-airgap-bot --dry-run`

Run. `npx tsc --noEmit`

Run. `npm test -- --runInBand`

## Task 7. Project pages state current facts and support paths

**Files**

- Create `CHANGELOG.md`
- Create `ROADMAP.md`
- Create `SUPPORT.md`
- Create `GOVERNANCE.md`
- Create `CODE_OF_CONDUCT.md`
- Create `.github/SECURITY.md`
- Change `README.md`
- Change `SECURITY.md`
- Change `CONTRIBUTING.md`
- Change `CODEOWNERS`
- Change `web/index.html`
- Change `web/styles.css`
- Change `web/app.js`
- Change `__tests__/scripts/web-build.test.js`

**Interfaces**

- README gives one current install path and one current primary GIF.
- The site explains checked behavior, boundaries, architecture, and seven templates.
- Security reporting uses GitHub private vulnerability reporting.

- [x] **Step 1. Write failing site contract tests**

Test the CLI command, no stale coming-soon copy, one main recording, keyboard
focus CSS, reduced-motion CSS, 320-pixel rules, and all seven template records.

- [x] **Step 2. Check the site contract fails on stale copy**

Run. `npm test -- --runInBand __tests__/scripts/web-build.test.js`

- [x] **Step 3. Rewrite README from checked release facts**

Use this order. description, primary recording, install, operating modes,
ability status, architecture, security boundary, templates, checked platforms,
limitations, support, contribution, and license. Link large GIFs in a table.

- [x] **Step 4. Rebuild the site as a support-system field guide**

Use the same navy, cyan, orange, and neutral palette as the app. Put the chosen
recording beside a live provenance card. Use visible focus and reduced motion.

- [x] **Step 5. Add project policy files with real maintainer paths**

State issue use, support scope, governance decisions, conduct enforcement,
security reporting, release cadence, and known roadmap boundaries.

- [x] **Step 6. Run prose, site, link, and size checks**

Run. `npm run web:build`

Run. `npm test -- --runInBand __tests__/scripts/web-build.test.js`

Run. `python3 /Users/xavier/.claude/skills/deslop/references/deslop_lint.py --mode prose --file README.md`

## Task 8. Fresh recordings tie every GIF to the checked commit

**Files**

- Create `scripts/record-demo.mjs`
- Create `scripts/record-industries.mjs`
- Create `scripts/build-readme-gif.mjs`
- Create `scripts/validate-recordings.mjs`
- Create `__tests__/scripts/validate-recordings.test.js`
- Create `demo/recordings.json`
- Replace `demo/airgap-demo.gif`
- Replace `demo/airgap-demo-ios.gif`
- Create `demo/airgap-readme-side-by-side.gif`
- Replace `demo/industry-airline.gif`
- Replace `demo/industry-banking.gif`
- Replace `demo/industry-electric.gif`
- Replace `demo/industry-healthcare.gif`
- Replace `demo/industry-insurance.gif`
- Replace `demo/industry-telco.gif`
- Replace `demo/industry-water.gif`

**Interfaces**

- Every script derives the repository path from its own file.
- Every run writes source MP4 and contact sheets under `tmp/recordings/<commit>/`.
- `demo/recordings.json` ties each GIF to its source and settings.

- [x] **Step 1. Write failing manifest and GIF validation tests**

```js
test('rejects an asset that exceeds its limit', () => {
  assert.throws(() => validateRecording(largeFixture), /recording_size_limit/);
});

test('needs a checked commit for every GIF', () => {
  assert.throws(() => validateManifest(missingCommit), /recording_commit_missing/);
});
```

- [x] **Step 2. Check the recording validator test fails**

Run. `npm test -- --runInBand __tests__/scripts/validate-recordings.test.js`

- [x] **Step 3. Add deterministic recording and conversion scripts**

Use 10 or 12 frames per second, 360-pixel width, Lanczos scaling, palette
generation, and exact start and end waits. Reset app data before each capture.

- [ ] **Step 4. Record the final Android and iOS flows**

Show operating state, answer sources, action receipt, outbox, and privacy controls.
Use no personal data, developer menu, red box, or staged result text.

- [ ] **Step 5. Record all seven Android industry flows**

Build each config, reset app data, follow one fixed quick-reply path, restore the
default config, and check the worktree before continuing.

- [ ] **Step 6. Build the new side-by-side README GIF**

Use the new path `demo/airgap-readme-side-by-side.gif`. Do not read, change, or
overwrite the untracked file in the main checkout.

- [ ] **Step 7. Create and inspect contact sheets and complete loops**

Check both platform GIFs, the joint GIF, and seven industry GIFs. Record duration,
dimensions, frame rate, byte size, commit, device, OS, mode, config, and date.

- [ ] **Step 8. Run recording validation**

Run. `npm run recordings:validate`

Expected size limits. README 5 MB, platform 8 MB each, industry 3 MB each,
and joint 8 MB.

## Task 9. Build, inspect, and prepare a local release candidate

**Files**

- Create `tmp/release/<commit>/evidence.md`
- Create `tmp/release/<commit>/website/`
- Create `tmp/release/<commit>/mobile/`
- Change release facts only when fresh checks change them.

- [ ] **Step 1. Run every deterministic check from a clean dependency install**

Run. `npm ci`

Run. `npm run format:check`

Run. `npm run lint`

Run. `npx tsc --noEmit`

Run. `npm test -- --runInBand --coverage`

Run. `npm run journeys`

Run. `npm run kb:validate`

Run. `npm run web:build`

Run. `npm run cli:pack:test`

Run. `npm run security:direct`

Run. `npm run recordings:validate`

- [ ] **Step 2. Build Android and iOS**

Run. `cd android && ./gradlew assembleDebug`

Run. `xcodebuild -workspace ios/Airgap.xcworkspace -scheme Airgap -sdk iphonesimulator -configuration Debug -derivedDataPath tmp/DerivedData build`

- [ ] **Step 3. Capture app and site screenshots**

Capture Android and iOS at default and large text. Capture the site at 1440,
768, 390, and 320 CSS pixels. Store screenshots under the release evidence path.

- [ ] **Step 4. Inspect the full diff and run secret checks**

Run. `git diff --check`

Run. `git status --short`

Run. `git diff --name-only`

Run the repository security scan before staging or a commit.

- [ ] **Step 5. Write the evidence report**

Record each command, exit code, test count, artifact path, byte size, screenshot,
recording result, open upstream advisory, and claim change.

- [ ] **Step 6. Stop before publication**

Use the finishing-a-development-branch workflow. Ask Xavier to choose local
merge, pull request, or branch preservation. Do not publish in this task.
