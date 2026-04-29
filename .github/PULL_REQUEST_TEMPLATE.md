<!-- Thanks for the PR. Please fill out the sections below. -->

## What this PR does

<!-- One paragraph. Lead with the *why*. -->

## How it's tested

- [ ] `npx tsc --noEmit` clean
- [ ] `npx eslint .` clean
- [ ] `npx jest` clean
- [ ] New test added for new behavior (if applicable)
- [ ] `node __tests__/run-journeys.mjs` clean (if touching orchestrator/search)
- [ ] `node __tests__/run-multi-turn.mjs` clean (if touching follow-up or prompt builder)
- [ ] `node __tests__/run-industry-tests.mjs` clean (if touching a vertical config)
- [ ] Manual device check on Android (describe device/emulator)
- [ ] Manual device check on iOS (describe device/simulator)

## Scope check

- [ ] `git diff --name-only` contains only files this change needs to touch
- [ ] No unrelated refactoring ridden along
- [ ] README / docs updated if user-visible
- [ ] No secrets, credentials, or binaries in the diff

## Safety / security

- [ ] No new hardcoded encryption key constants (use `createKeyedMMKV`)
- [ ] No new hardcoded refusal strings (use `refusalFor(reason)`)
- [ ] No `console.log` in committed code (use `logger`)
- [ ] If a new tool was added, it has an adversarial test case in
      `__tests__/golden/adversarial.json` and a keyword that does not
      collide with an existing tool
