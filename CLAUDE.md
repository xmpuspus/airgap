# Airgap repository guidance

Airgap is a React Native starter kit for offline-first mobile customer support.
The default ACME Telecom app and all industry data are fictional test fixtures.

## Request path

1. `src/services/orchestrator.ts` checks blocked topics and deterministic action routes.
2. `src/services/searchService.ts` retrieves approved local documents.
3. `src/services/inference/providerResolver.ts` applies operator policy to the provider chain.
4. The active provider phrases the retrieved facts. It does not choose tools or approve actions.
5. `src/services/safetyLayer.ts` checks sourced amounts and dates before display.

Demo mode uses deterministic document answers and makes no model request. Production modes can
use Apple Foundation Models, Android ML Kit Prompt API, a downloaded `llama.rn` model, or an
authenticated cloud service. Provider state and answer identity must stay visible to the user.

## Key files

- `airgap.config.json` and `airgap.schema.json` define the public configuration contract.
- `src/services/orchestrator.ts` coordinates support requests.
- `src/services/inference/` holds the provider contract, policy, adapters, and status copy.
- `src/services/backendConnector.ts` defines the mock and REST action boundary.
- `src/services/syncService.ts` handles signed knowledge updates.
- `src/services/secureStorage.ts` holds encrypted user-data stores.
- `scripts/record-demo.mjs` runs the platform recording workflow.
- `demo/recordings.json` holds checked recording facts.

## Commands

```bash
npm ci
npm run docs:check
npm run format:check
npm run lint
npx tsc --noEmit
npm test -- --runInBand
npm run journeys
npm run kb:validate
npm run recordings:validate
```

Use JDK 17 for Android and Xcode 26 or newer for the Foundation Models bridge. The default demo
works on emulators and simulators. Native provider runtime claims need named physical-device
evidence.

## Change rules

- Write a failing test before a behavior change.
- Change schema, config types, validation, examples, package templates, and public docs together.
- Keep model choice outside tool choice, authorization, and state-changing action approval.
- Never commit model files, credentials, customer data, raw recordings, or native build output.
- Record screenshots or GIFs only from a committed application state, then check and inspect
  the media before marking `loopReviewed` true.

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the full review checklist.
