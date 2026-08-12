# Contributing to Airgap

Airgap accepts focused bug fixes, tests, documentation, accessibility work, and
changes that improve the offline-first mobile support path. Read
[`ROADMAP.md`](ROADMAP.md) before starting a large feature.

## Before you start

Use a GitHub issue for a reproducible bug or a feature request that changes the
public configuration contract. For a security problem, follow
[`SECURITY.md`](SECURITY.md) and use private vulnerability reporting.

Keep one pull request focused on one outcome. Do not include model
files, credentials, customer data, unrelated formatting, or a new network
service that the issue did not discuss.

## Local setup

```bash
git clone https://github.com/xmpuspus/airgap.git
cd airgap
npm ci
```

For iOS work, run these commands.

```bash
bundle install
cd ios
bundle exec pod install
cd ..
```

The default demo mode does not need a GGUF model. Run the model download only
when your change covers local inference and you intend to check the expected
model bytes on a supported device.

## Development rules

- Write a failing test before changing behavior. Check that it fails for the
  reason you expect.
- Keep TypeScript strict. Avoid `any`. Document an unavoidable native boundary.
- Open user-data stores through `src/services/secureStorage.ts` after startup.
- Use the installed token provider for authenticated mobile requests. Never put
  a bearer token or OAuth client secret in configuration.
- Check downloaded bytes before swapping a model or knowledge bundle.
- Keep user-visible queue, sync, model, and deletion states tied to stored facts.
- Use the logger service for diagnostic output and avoid sensitive values.
- Update schema, example configuration, tests, and docs together when you change
  a public config field.

## Checks

Run the smallest focused test while developing. Before requesting review, run
these commands.

```bash
npm run format:check
npm run lint
npx tsc --noEmit
npm test -- --runInBand
npm run journeys
npm run kb:validate
npm run server:test
npm run cli:pack:test
npm run security:direct
npm run recordings:validate
```

Run `cd android && ./gradlew assembleDebug` after native Android, dependency, or
build configuration changes. Run the CI iOS Simulator build command after the
equivalent iOS changes.

When a change affects the site or mobile interface, capture the relevant widths,
font sizes, and platform screens. Check keyboard focus, screen-reader labels,
reduced motion, text scaling, contrast, wrapping, loading, empty, error, and
offline states.

## Knowledge and templates

Keep all seven templates valid. A template change usually needs its config,
knowledge documents, journey fixtures, and fresh recording to move together.
Run `npm run kb:validate` and the industry journey runner before submitting it.

Do not use personal data or a real company account in examples or recordings.

## Pull request checklist

- [ ] The pull request explains the user or operator problem.
- [ ] A test failed before the behavior change and passes afterward.
- [ ] Relevant deterministic checks pass from the current commit.
- [ ] Native builds pass when native code or dependencies changed.
- [ ] Public behavior, limitations, schema, and migration notes are current.
- [ ] UI changes include screenshots or recordings that you inspected.
- [ ] `git diff --name-only` lists only intended files.
- [ ] The diff has no secret, customer data, model binary, or build output.
- [ ] The change follows the Code of Conduct.

## Review and release

The maintainer can request smaller scope, more tests, migration notes, or a
threat-model update. Approval does not set an immediate release date. The
release process follows [`GOVERNANCE.md`](GOVERNANCE.md) and records user-visible
changes in [`CHANGELOG.md`](CHANGELOG.md).
