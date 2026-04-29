# Contributing to Airgap

Thanks for considering a contribution. This is a React Native + on-device
LLM project, so PRs touch a mix of TypeScript, native build files, and
config schemas. The bar for merging is:

1. Code type-checks and lints clean
2. All existing tests still pass
3. New behavior has at least one test
4. The PR is scoped — one change, one review

## Local setup

```bash
git clone https://github.com/xmpuspus/airgap.git
cd airgap
npm install
cd ios && pod install && cd ..   # iOS only
```

To run the LLM journey suite you need a real GGUF. Fetch the shipped
target with:

```bash
bash scripts/pull-dev-model.sh
```

This downloads Gemma 4 E2B Q3_K_S (~2.4 GB) into `models/` and verifies
its SHA256. See `scripts/pull-dev-model.sh` for the exact checksum.

## Running tests

| What | How | When |
|---|---|---|
| Unit tests | `npx jest` | Every change |
| Type check | `npx tsc --noEmit` | Every change |
| Lint | `npx eslint .` | Every change |
| Single-turn journeys | `node __tests__/run-journeys.mjs` | Touching orchestrator, search, routing |
| Multi-turn conversations | `node __tests__/run-multi-turn.mjs` | Touching follow-up detector, prompt builder |
| Industry tests | `node __tests__/run-industry-tests.mjs` | Touching a vertical's config or KB |
| LLM journeys | `node __tests__/run-llm-journeys.mjs` | Touching prompts, safety layer, tool routing |
| Adversarial fixtures | `npx jest adversarial` | Adding or editing blocklist entries |
| KB schema check | `npm run kb:validate` | Editing KB JSON files |

CI runs all of the above (except the LLM journey suite, which needs the
real GGUF). A PR that breaks CI gets feedback from reviewers, not a merge.

## Code style

- TypeScript strict mode. No `any` unless you explain why in a comment.
- Prefer composition over inheritance. Prefer async/await over Promise
  chains. Prefer `const` over `let`.
- Comments explain WHY, not WHAT. Don't narrate obvious code.
- No `console.log` in committed code — use the `logger` service so
  redaction and listeners work.
- No new encryption key constants. Use `createKeyedMMKV(id)` from
  `src/services/secretStore.ts`.
- No hardcoded strings in response paths that should go through the
  safety layer — use `refusalFor(reason)` so operators can override.

## Pull request checklist

Before opening a PR, run through this list:

- [ ] `npx tsc --noEmit` passes
- [ ] `npx eslint .` passes
- [ ] `npx jest` passes (110+ tests)
- [ ] At least one new test for any new behavior
- [ ] `git diff --name-only` shows only files you intended to touch
- [ ] Commits are small and focused; rebase if you have fixup commits
- [ ] PR description explains the *why*, not just the *what*
- [ ] No `.env` files, credentials, or large binaries in the diff
- [ ] README / docs updated if the change is user-visible

## Benchmarks

Airgap has a device-benchmark harness in `bench/`. Reproduce on your
hardware with:

```bash
bash bench/run-node.sh       # local node smoke
bash bench/run-android.sh    # Pixel-class device or emulator
bash bench/run-ios.sh        # iPhone simulator
```

Each run drops a JSON file in `bench/results/`. To submit a new device
row, commit the result file and run `node bench/render-table.mjs` so the
table inside README.md picks up your numbers. PR both files together.
Keep one device per file; the renderer takes the newest run per device
based on the filename timestamp suffix. See [bench/README.md](bench/README.md)
for the schema and full workflow.

## Reporting bugs

Open an issue with:

- What you did
- What you expected to happen
- What actually happened
- Device model, OS version, and app version
- A minimal reproduction if possible

For security issues, do NOT open a public issue. See
[SECURITY.md](SECURITY.md) for the disclosure channel.

## Scope and non-goals

Airgap is a framework for offline-resilient customer support bots on
mobile devices. PRs that add the following are usually out of scope:

- Additional LLM runtimes beyond llama.rn (unless your runtime supports
  the same llm.mode routing contract)
- Browser/desktop ports (would fork the mobile assumptions)
- Vertical-specific business logic that belongs in a BFF, not the device
- Feature flags for "maybe later" ideas (delete them until they're real)

When in doubt, open a discussion or a draft PR before spending hours on
an implementation.
