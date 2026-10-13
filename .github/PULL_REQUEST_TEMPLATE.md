<!-- Fill in each section. -->

## What this PR does

<!-- One paragraph. Lead with the *why*. -->

## How it's tested

- [ ] The checks in CONTRIBUTING.md pass (list any you skipped and why)
- [ ] Manual device check on Android (describe device/emulator)
- [ ] Manual device check on iOS (describe device/simulator)

## Scope check

- [ ] `git diff --name-only` contains only files this change needs to touch
- [ ] No unrelated refactoring ridden along
- [ ] README / docs updated if user-visible
- [ ] No secrets, credentials, or binaries in the diff

## Safety / security

- [ ] No new hardcoded encryption key constants (open stores through `src/services/secureStorage.ts`)
- [ ] No new hardcoded refusal strings (use `refusalFor(reason)`)
- [ ] No `console.log` in committed code (use `logger`)
- [ ] If a new tool was added, it has an adversarial test case in
      `__tests__/golden/adversarial.json` and a keyword that does not
      collide with an existing tool
