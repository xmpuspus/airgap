# Airgap Professionalization Design

| Status | Proposed for the build |

| Date | 2026-08-11 |

## Purpose

Turn Airgap from a credible reference application into a dependable open-source
starter kit for offline-first mobile customer support. The finished release must
make its operating state visible, keep its security and privacy statements true,
give users one reliable installation path, and publish evidence for every supported
claim.

Airgap will not position itself as a general inference engine or a complete
enterprise agent platform. It uses `llama.rn` as its first inference
adapter. Airgap gives users local knowledge retrieval,
answer provenance, action handling, offline recovery, configuration, and a
production-oriented reference backend.

## Product Boundary

### Supported in the first professional release

- React Native application for Android and iOS.
- Demo mode that needs no model or network connection.
- Local inference through the set-up `llama.rn` model.
- Optional cloud generation through an installed token provider.
- Local MiniSearch knowledge retrieval with visible citations.
- Seven industry template configurations and knowledge bases.
- Offline action queue with explicit pending, failed, retrying, and completed
  states.
- The device checks signed knowledge updates.
- Authenticated reference backend with bounded request handling.
- Versioned `create-airgap-bot` scaffolding from files shipped inside the npm
  package.

### Explicitly outside the first release

- A hosted control plane.
- Claims of HIPAA, GDPR, FedRAMP, or other regulatory compliance.
- Built-in identity-provider login flows.
- Production credentials embedded in application configuration.
- Multiple native inference engines.
- Automatic execution of sensitive actions when an operator has not set up a
  backend and authorization policy.

## User Experience

### Design direction

The application looks and behaves like a compact field-support console rather
than a generic social chat application. Its signature element is an answer
provenance rail. Each response shows whether it came from local knowledge,
local generation, cloud generation, or an action result, and exposes the
knowledge version and sources without requiring technical vocabulary.

The palette uses deep navy for durable structure, accessible cyan for primary
actions, orange only for attention, and neutral surfaces for answer content.
The design uses these default colors.

- `#0B1F33` deep navy
- `#0E7490` action cyan
- `#155E75` pressed cyan
- `#C2410C` attention orange
- `#F6F8FA` canvas
- `#FFFFFF` surface

The design places white text only on colors that meet WCAG AA contrast for normal
text. System body fonts stay native for legibility and bundle size. A monospaced
utility face displays model, knowledge-version, and diagnostic metadata.

### Onboarding

The first screen offers three truthful paths.

1. **Try the offline demo.** Make no download and no network calls.
2. **Install local AI.** Check available storage and supported architecture,
   explain the exact download size, then download and check the set-up
   model.
3. **Use set-up service.** Show this path only after an operator installs a cloud
   token provider and enables cloud generation.

The screen makes no claims about upstream model capabilities, regulatory status,
or physical-device performance unless release evidence supports each claim.

### Conversation

- The header shows one operating state. The states are Demo, Local, Cloud, and Offline.
- Bot responses lead with a concise answer.
- Supporting documents appear in a collapsible evidence section.
- Show tool results as action receipts. Do not show raw developer output.
- Keep queued actions and their status visible in an outbox.
- Keep the backend error category and give Retry and Remove
  controls.
- Remove the attachment control until attachment handling exists.
- Wrap quick replies within the viewport and keep keyboard and screen-reader
  accessible.
- Restore and clear conversation display state and model context together.

### Settings and privacy

- Derive privacy text from the active generation, sync, and telemetry modes.
- Delete All My Data removes conversation data, queue records, telemetry buffers,
  sync state and downloaded knowledge, model state and model files, preferences,
  and onboarding state.
- Model storage reports set-up size, installed size, checksum status, and
  last verification time.
- Keep diagnostics available behind configuration or the documented version
  gesture, but use plain user-facing labels.
- Motion respects the platform reduced-motion setting.

## Security Architecture

### Local storage

`react-native-keychain` holds random MMKV encryption keys. The application
initializes secure storage before any service creates a store. Conversation,
queue, sync, telemetry, model-management, and preference
stores use separate keys. The application fails closed for sensitive storage if
the platform key store cannot initialize. It does not derive predictable keys
from installation identifiers.

The bootstrap path stores only a schema version and has no user content or
key material.

### Knowledge update verification

The reference backend signs the exact downloaded bundle bytes with Ed25519. The
manifest includes algorithm, signature encoding, byte length, SHA-256, knowledge
version, and key identifier. The application checks these items in order.

1. HTTPS response and bounded content length.
2. Expected byte length.
3. SHA-256 digest.
4. Ed25519 signature against a pinned public key.
5. Bundle schema before the atomic swap.

Any failure preserves the last valid bundle and records a non-sensitive error
code for diagnostics. Signature checks are not an optional platform hook but a
part of the default build.

### Authentication

Static bearer tokens and OAuth client secrets are not accepted in bundled
configuration. Mobile applications install an asynchronous access-token
provider at startup. The REST connector asks that provider for a short-lived
token for each authenticated request and never logs it.

The reference backend supports a bearer secret supplied through its environment,
uses timing-safe comparison, enforces request-body limits, applies an in-memory
per-client rate limit suitable for a single-node reference deployment, and
documents the reverse-proxy requirements for production deployments.

Remove unsupported GraphQL and endpoint-remapping configuration from the schema
until the code supports them.

### Supply chain

The root npm workspace is private. `create-airgap-bot` ships an allowlisted,
version-matched application template inside its npm tarball. It makes no
download from a mutable branch and has no archive extraction dependency.

CI blocks direct high or critical dependency advisories, checks the packed file
list and size, and runs dependency review on pull requests. The repository adds
Dependabot, CodeQL, and OpenSSF Scorecard configuration.

## Runtime Reliability

### Action queue

Queue records have `pending`, `processing`, `failed`, and `completed` states,
retry count, last try time, error code, and completion receipt. Backend
failures produce failed records rather than fallback success messages. Each
state-changing request carries the queue record ID as an idempotency key.

The queue replays actions one at a time. It does not retry a failed item in the
same replay cycle. Operators set the retry limit. The default is three.

### Model lifecycle

- Check existing model files against the set-up byte length and SHA-256 before
  marking them ready.
- Delete partial files and restart downloads because the current file-system
  adapter cannot append multi-gigabyte downloads safely.
- Download progress never exceeds 100 percent.
- Clear generation timeouts after success or failure so they cannot stop a
  later request.
- Model download, verification, load, and generation errors use stable error
  codes with actionable user messages.

### Configuration contract

Every schema field must have a production consumer and a focused test. Fields
without consumers are removed. Configuration validation reports unsupported
combinations, including cloud mode without a token provider and sync without a
pinned signing key.

## Code Structure

The existing service boundaries stay in place. Add these files.

- `secureStorage.ts` handles platform keys and keyed MMKV creation.
- `conversationStore.ts` stores visible messages and model context together.
- `dataDeletionService.ts` registers all user-data removal operations.
- `authProvider.ts` defines the installed access-token provider.
- `bundleVerifier.ts` checks byte length, hash, Ed25519, and schema.
- `actionQueueTypes.ts` defines queue state and receipts.
- `useReducedMotion.ts` reads the platform accessibility setting.
- `OperatingState.tsx` shows Demo, Local, Cloud, and Offline status.
- `AnswerProvenance.tsx` shows source, knowledge version, and evidence.
- `ActionReceipt.tsx` shows queued, failed, and completed actions.
- `OutboxScreen.tsx` lets users review, retry, and remove queue items.

Large existing files are split only where these responsibilities are currently
mixed. `MessageBubble` delegates evidence and receipt presentation. The
orchestrator delegates persistence, verification, and queue execution rather than
absorbing more responsibilities.

## Documentation and Public Project

The README becomes a concise entry page with these items.

- Exact one-sentence description.
- One fresh side-by-side Android and iOS recording.
- Published CLI quickstart.
- Ability-status table.
- Checked device/model table.
- Architecture and security boundary links.
- Known limitations and support status.

The README links to separate platform and industry recordings in a compact
table. It does not embed all large GIF files. Test counts, build status,
versions, platform floors, and model results come from the release evidence.

### Real recordings

Record release media only after the final interface, copy, and platform builds
pass. Each GIF must come from a real Android Emulator or iOS Simulator session.
Do not use browser replicas, CSS mockups, personal data, developer overlays, or
staged result text.

The release includes these recording outputs.

- `demo/airgap-demo.gif` shows the complete Android flow.
- `demo/airgap-demo-ios.gif` shows the complete iOS flow.
- `demo/airgap-readme-side-by-side.gif` combines matched concise platform flows.
- Seven `demo/industry-*.gif` files show the final industry configurations.
- `demo/kb-studio.gif` gets a new recording when that flow or its copy changes.
- `demo/recordings.json` records each release asset's source and settings.

The new side-by-side path protects the existing untracked
`demo/airgap-demo-side-by-side.gif`. The build must not change or overwrite that
user-owned file. The build preserves the two untracked tight recording
scripts. New tracked scripts can use the same interaction ideas without editing
those files.

Reset application data before each capture. Use the same scripted path, seeded
content, crop, and duration for both concise platform recordings. Show the
operating state, answer sources, action receipt, outbox, and privacy controls.

Use deterministic `ffmpeg` commands with 10 or 12 frames per second, a 360-pixel
width, Lanczos scaling, and an optimized palette. Apply these size limits.

- The primary README GIF is at most 5 MB.
- Each complete platform GIF is at most 8 MB.
- Each industry GIF is at most 3 MB.
- The side-by-side GIF is at most 8 MB.

Store source MP4 files under `tmp/recordings/<commit>/` outside version control.
The recording manifest includes the commit SHA, source file, script, platform,
OS, device, application mode, configuration, duration, dimensions, frame rate,
capture date, and byte size.

`scripts/validate-recordings.mjs` checks manifest paths, GIF headers, dimensions,
duration, frame rate, and size limits. The recording workflow creates
contact sheets. Reviewers inspect every contact sheet and watch each complete
loop before approving the media.

The static website becomes a project homepage explaining the problem, checked
behavior, installation path, architecture, and seven templates. It uses optimized
media, works at 320 CSS pixels without horizontal overflow, shows visible
keyboard focus, and respects reduced motion.

The repository adds `CHANGELOG.md`, `ROADMAP.md`, `SUPPORT.md`, `GOVERNANCE.md`,
`CODE_OF_CONDUCT.md`, and `CODEOWNERS`. Security reporting points to GitHub's
private vulnerability reporting flow rather than a nonexistent email address.

Repository topics, homepage metadata, release creation, tag creation, package
publication, and branch protection are external changes. They happen only after
the local release candidate passes every acceptance gate. The main agent then
checks the correct GitHub and npm identities. No social, email, or chat promotion is part of
this work.

## Testing and Evidence

Behavior changes follow red-green-refactor development. The release candidate
must give this evidence.

- Focused unit tests for signature validation, secure-store failure, access-token
  handling, queue failure and retry, complete deletion, timeout cleanup, model
  file verification, and configuration combinations.
- Integration tests that call the production orchestrator, connector, and queue
  implementations through injected platform adapters.
- Android debug build in CI.
- iOS simulator build in CI.
- Formatting, lint, type checking, unit tests, journey tests, knowledge validation,
  CLI packed-install test, direct-advisory gate, and coverage reporting.
- Targeted branch thresholds of at least 80 percent for authentication, bundle
  verification, queue state transitions, deletion, and model integrity helpers.
- Rendered Android and iOS screenshots checked at default and large text sizes.
- Website screenshots at 1440, 768, 390, and 320 CSS pixels.
- Recording checks for GIF format, dimensions, duration, frame rate, and size.
- Contact sheets and complete-loop reviews for both platforms and seven industries.
- Publish a model performance statement only after a physical-device result for
  the declared Gemma 4 model supports it.

The deterministic journey scripts are not full end-to-end tests but fixture
tests. They mirror parts of the production routing logic.

## Release Sequence

1. Merge security and runtime corrections with regression tests.
2. Merge the conversation, outbox, privacy, and accessibility changes.
3. Merge deterministic packaging, CI, and repository policy files.
4. Build and inspect Android, iOS, npm package, and website artifacts.
5. Record and inspect final Android, iOS, side-by-side, and industry GIFs.
6. Rewrite the README and website after all claims match checked evidence.
7. Check the correct GitHub and npm identities.
8. Commit explicit files, push a release branch, open a reviewable pull request,
   and wait for needed checks.
9. After merge authorization, tag the checked commit, publish the CLI package,
   create the GitHub release, and check each public artifact independently.

## Acceptance Gates

The work is ready for release review only when all conditions below are true.

- No documented security control contradicts the code.
- The default build rejects invalid or unsigned knowledge bundles.
- No predictable fallback key protects user data.
- Backend failures never become completed action receipts.
- Delete All My Data removes every registered user-data store and file.
- The CLI scaffolds from its own npm package without fetching mutable source.
- The root package blocks accidental publication.
- Android and iOS builds pass in the current session and CI definition.
- Formatting, lint, type checking, unit, integration, journey, and knowledge checks
  pass.
- Direct high and critical dependency advisories are zero.
- The application and website pass the defined visual and accessibility checks.
- Fresh real recordings cover Android, iOS, the joint view, and seven industries.
- Every recording passes the manifest, file, size, and complete-loop checks.
- Recording scripts preserve the three user-owned untracked files.
- README test counts, versions, platform floors, and model claims match checked
  evidence.
- The README embeds one current recording and links to the checked recording set.
- A versioned changelog, support policy, governance policy, security path, and
  release rollback procedure exist.
