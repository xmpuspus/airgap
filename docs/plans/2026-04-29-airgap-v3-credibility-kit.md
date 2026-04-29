# Airgap v3 Credibility Kit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Each phase below resolves to its own per-phase detail plan written when that phase starts.

**Goal:** Ship Airgap v3 credibility kit across 6 phases (P1–P6) so a fresh clone runs in <5 min, every grounded answer cites its source, all 7 verticals have a public showcase, and operators can `npx create-airgap-bot --template <industry>` to spin up their own.

**Architecture:** All-industry single code path. Demo mode reuses the existing MiniSearch+format pipeline (no faked LLM responses, no telco-only regex). Citations ride the existing `audit.kbDocIds` plumbing. Showcase wraps real recorded GIFs in static HTML chrome, never simulated chat. Scaffolder + KB Studio are pure-Node CLIs that reuse existing kb-validate/kb-import functions.

**Tech Stack:** React Native 0.84.1 + llama.rn + MiniSearch (mobile, unchanged). Vanilla HTML/CSS/JS (P4 showcase, no framework). Node 22+ (P5 scaffolder, P6 KB Studio). GitHub Pages via gh-pages branch.

---

## Context

Airgap is a config-driven offline-first React Native chatbot framework. The v3 credibility kit (parked from 2026-04-18 synthesis) makes the framework legible to enterprise evaluators: real device numbers, citation chips, public showcase, scaffolder, KB tooling. All work must extend across all 7 verticals (telco, banking, healthcare, airline, insurance, electric utility, water utility). No LinkedIn framing, no HTML phone mockups, no telco-only scoping, no fake LLM responses.

The current state already provides most of the plumbing: `audit.kbDocIds` flows through `OrchestratorResponse` → `BotMessage`, `useModelDownload` already gates on `llm.demo`, all 7 examples have real configs (211–309 lines each) + populated KB dirs, demo GIFs already exist. The work is mostly surfacing what's already there + adding net-new packages and tooling.

---

## Locked architectural decisions

1. **`llm.mode = "demo"` migration.** Add `"demo"` to the `llm.mode` enum in `airgap.schema.json`. Keep `llm.demo: true` as a back-compat alias (loader maps it to `mode: "demo"`). Three call sites: `src/config/loader.ts`, `src/hooks/useModelDownload.ts`, `src/services/llmRouter.ts`.

2. **Demo response generation = MiniSearch top-K + simulated streaming.** Refactor `src/services/demoLlmService.ts` away from telco-only regex. New behavior: take the orchestrator's already-retrieved top-K KB docs, format them as a streamed reply (token-by-token with realistic timing). Works across all 7 verticals automatically because every vertical has a populated KB. The 7 hardcoded telco regex entries get deleted.

3. **Citations data flow.** `OrchestratorResponse.audit.kbDocIds` is already populated. New: add `getDocumentById(id): KBDocument | null` to `searchService.ts` (lookup by id from the indexed corpus). MessageBubble fetches each doc to render `category › title` chips below the bubble text, above the existing `SourceBadge`. Tap a chip → bottom sheet drawer with full doc title + content. No em-dash in any chip copy (use `›` separator).

4. **P4 web showcase = phone bezel chrome + real GIF.** Static HTML/CSS/JS in `web/` (no React, no build step). Industry `<select>` swaps: brand block, theme swatches, two-column JSON snippet, and the framed `industry-<vertical>.gif`. The phone bezel is pure CSS chrome around an `<img>`. No simulated chat, no fake bubbles. GitHub Pages deploy via `.github/workflows/deploy-web.yml` to `gh-pages`.

5. **P5 scaffolder = `create-airgap-bot` Node CLI, published to npm.** Conflict-check name on npm and GitHub before publishing. Falls back to `@xmpuspus/create-airgap-bot` if taken. Skeleton clone via degit-style tarball fetch, then copy `examples/<template>/` over the defaults. Renames Android package, iOS bundle id, app name. End state after a fresh clone: `cd my-bot && npm install && npm run android` succeeds in demo mode.

6. **P6 KB Studio Lite = interactive Node CLI in `scripts/kb-studio.js`.** Extracts pure functions from `kb-validate.js` + `kb-import.js` into `scripts/lib/kb.js`, then `kb-studio.js` orchestrates: pick CSV → validate → preview MiniSearch hits → export JSON to chosen industry → run journey suite. No new deps unless minimal (`prompts` or built-in `readline`).

7. **P2 benchmark harness = `bench/` directory + `bench/run.sh`.** Records device, model, first-token latency, tokens/sec, RAM peak (Android via `adb shell dumpsys meminfo`, iOS in demo mode = N/A with explicit label). Output: `bench/results/{device}-{date}.json` and a markdown table rendered into README via `bench/render-table.mjs`. Reuses existing `Date.now()` instrumentation in `src/services/llmService.ts` (lines 27, 70, 102) plus a new first-token hook.

8. **One PR per phase. Worktrees per phase.** P5 + P6 may run as parallel worktrees because their dirs (`packages/create-airgap-bot/` vs `scripts/kb-studio.js`) don't conflict. All other phases serial.

---

## Phase 1 — Demo mode productization

**Goal:** Fresh clone runs `npm run android` in <5 min with zero model download. Demo mode banner visible in chat. All 7 verticals work in demo via MiniSearch+format.

**Files:**
- Modify: `airgap.schema.json` (add `"demo"` to `llm.mode` enum, deprecate `llm.demo` boolean with `description`)
- Modify: `airgap.config.json` (set `llm.mode: "demo"` for default, drop `llm.demo`)
- Modify: `src/config/loader.ts` (back-compat: map `llm.demo: true` → `mode: "demo"` if present)
- Modify: `src/services/llmRouter.ts` (route `mode: "demo"` to demoLlmService; remove the `llm.demo` boolean check at line 88)
- Modify: `src/services/demoLlmService.ts` (delete telco regex array, replace with `formatTopKAsStreamedReply(kbDocs, onToken)`)
- Modify: `src/services/orchestrator.ts` (when `mode === "demo"`, pass `finalResults` directly to demo formatter; bypass safety/grounding LLM step)
- Modify: `src/hooks/useModelDownload.ts` (already short-circuits on demo; verify with new mode value)
- Create: `src/components/chat/DemoBanner.tsx` (one-line "Demo mode: scripted local responses, no on-device LLM" banner; theme-aware; uses `›` not em-dash)
- Modify: `src/screens/ChatScreen.tsx` (render `<DemoBanner>` above message list when `getMode() === 'demo'`)
- Modify: `examples/<vertical>/airgap.config.json` ×7 (add `llm.mode: "demo"` to all 7)
- Create: `__tests__/demo-mode.test.ts` (unit: demo response is deterministic given same KB hits; cross-vertical test runs all 7 KB dirs through demo formatter)
- Modify: `README.md` (3-command quickstart: clone, npm install, npm run android — no model download mentioned)

**Definition of done:**
- `npm test` green (110 → ~115 tests)
- `npm run android` from a fresh clone reaches the chat screen in <5 min on a Pixel emulator
- Sending "What plans do you have?" returns a streamed response sourced from telco KB
- Switching `airgap.config.json` symlink to `examples/banking/airgap.config.json` and rebooting Metro: same query returns banking response
- DemoBanner visible at top of chat in demo mode, hidden in `prefer-offline` / `offline-only`
- No telco-specific strings in `demoLlmService.ts`

**Routing:** Single session. `simple first` — schema + 6 source files + 1 component + 7 example config edits.

---

## Phase 2 — Device benchmark harness

**Goal:** Reproducible `bench/run.sh` that produces a real device/model performance table rendered in README.

**Files:**
- Create: `bench/README.md` (how to run, what each metric means, env requirements)
- Create: `bench/run.sh` (orchestrates Android adb path: starts emulator if needed, runs benchmark suite, writes JSON)
- Create: `bench/run-ios.sh` (iOS simulator path, demo-only with explicit "demo mode" label in output)
- Create: `bench/lib/measure.js` (pure Node: parses adb logcat for first-token timing, parses dumpsys for RAM peak)
- Create: `bench/queries.json` (10 fixed prompts, one per category, used across all runs for fair comparison)
- Create: `bench/results/.gitkeep` + per-run files like `pixel6-emu-2026-04-29.json`
- Create: `bench/render-table.mjs` (reads results/*.json, emits markdown table, injects into README between markers)
- Modify: `src/services/llmService.ts` (add `onFirstToken` callback fired exactly once at first token; add `getLastRunStats(): {loadMs, firstTokenMs, totalMs, tokenCount}`)
- Create: `src/dev/benchHarness.ts` (dev-only RN screen accessible via `__DEV__` flag; runs queries.json against current LLM mode, posts results back to host via metro bundler logs)
- Modify: `__tests__/services/` add `bench-harness.test.ts` (unit: first-token callback fires once, stats record correctly)
- Modify: `README.md` (insert `<!-- BENCH:START -->` and `<!-- BENCH:END -->` markers; include current results)
- Modify: `CONTRIBUTING.md` (document how to run bench locally + how to PR new device rows)

**Definition of done:**
- `bash bench/run.sh` from a fresh clone with a running Pixel 6 emulator produces `bench/results/pixel6-emu-<date>.json` with 5 fields populated (device, model, firstTokenMs, tokensPerSec, ramPeakMB)
- `node bench/render-table.mjs` updates README between markers without touching any other section
- iOS row labeled `demo mode` and explicitly excludes tokensPerSec (demo formatter is deterministic, not LLM)
- README renders the markdown table cleanly
- 1 baseline result committed: Pixel 6 emulator running Gemma 4 E2B Q3_K_S
- Test suite green

**Routing:** Subagent team (3 agents in worktree):
- agent A: instrument `llmService.ts` + write `benchHarness.ts` + tests
- agent B: write `bench/run.sh` + `bench/lib/measure.js` + `bench/queries.json`
- agent C: write `render-table.mjs` + README marker integration + CONTRIBUTING update

Main session integrates and runs the actual baseline benchmark.

---

## Phase 3 — Source citations in chat

**Goal:** Every grounded LLM answer (search source, tool source, llm source) shows tappable `category › title` chips. Tapping opens a bottom-sheet drawer with full source content. All-industry by construction.

**Mandatory pre-code skills (per CLAUDE.md):** Invoke `/frontend-design` + `/ui-ux-pro-max` BEFORE writing any UI code. Pull design tokens, motion specs, accessibility checks from those skills.

**Files:**
- Modify: `src/services/searchService.ts` (add `getDocumentById(id: string): KBDocument | null` — already-indexed corpus lookup)
- Modify: `src/types/chat.ts` (BotMessage already has `audit?: MessageAudit`; no schema change needed)
- Create: `src/components/chat/CitationChips.tsx` (renders chip row from `audit.kbDocIds`; reads `category` + `title` via `getDocumentById`; max 3 chips; tap opens drawer)
- Create: `src/components/chat/SourceDrawer.tsx` (RN `Modal` with bottom-sheet animation; renders full doc `title` + `content` + `category` tag; close button; theme-aware light/dark)
- Modify: `src/components/chat/MessageBubble.tsx` (insert `<CitationChips>` between bubble text and existing `<SourceBadge>` at line 463; pass `message.audit?.kbDocIds`)
- Modify: `src/screens/ChatScreen.tsx` (host `<SourceDrawer>` at screen level, controlled via context or hook)
- Create: `src/hooks/useSourceDrawer.ts` (open/close drawer with selected docId)
- Create: `__tests__/components/CitationChips.test.tsx` (renders chips for given kbDocIds, calls drawer.open with correct id on press, max 3 visible with overflow indicator)
- Create: `__tests__/components/SourceDrawer.test.tsx` (renders title + content; close button works; non-existent docId renders fallback)
- Modify: `__tests__/journeys.ts` (add `expectCitations: string[]` field; assertion that LLM-source responses surface kbDocIds)
- Modify: `src/services/searchService.ts` test file (cover `getDocumentById` happy path + null path)
- Re-record: `demo/airgap-demo.gif` + `demo/airgap-demo-ios.gif` showing citations + drawer (per `feedback_real_gifs_not_screenshots.md`: real emulator capture, autopilot for iOS, then revert autopilot)

**Definition of done:**
- Asking "What plans?" in telco demo shows 1–3 chips like `Plans › Super Surf 99`
- Tapping a chip opens drawer showing full plan details from `examples/telco/knowledge/plans.json`
- Chip text uses `›` separator (no em-dash, per scoped frontend-patterns rule)
- Demo GIF on Android + iOS shows citation interaction in <30s
- All-industry verified: switch config to banking, ask "What savings accounts?", chips show `Accounts › ...` from banking KB
- Test suite green, journey tests assert citations on grounded answers
- Light + dark mode both render correctly
- Touch targets ≥44pt for chips and drawer close button

**Routing:** Single session. UI is tightly coupled, named skills (`/frontend-design` + `/ui-ux-pro-max`) are mandatory pre-code per CLAUDE.md.

---

## Phase 4 — Static web showcase

**Goal:** Public URL where a visitor picks an industry from a dropdown and sees: brand block, theme swatches, JSON config snippet, and a phone-bezel-framed real GIF for that vertical. No simulated chat, no React, no build step.

**Files:**
- Create: `web/index.html` (single-page; `<select>` industry switcher; sections for brand, theme, config, framed GIF)
- Create: `web/styles.css` (CSS phone bezel chrome with rounded corners, notch, button silhouettes; vanilla layout)
- Create: `web/app.js` (vanilla JS, fetches `web/data/<vertical>.json`; updates DOM on `<select>` change)
- Create: `web/data/<vertical>.json` ×7 (extracted brand + theme + condensed JSON snippet + GIF path; one per industry)
- Create: `web/data/build.mjs` (Node script that reads `examples/<vertical>/airgap.config.json` and emits `web/data/<vertical>.json`; runs in CI)
- Create: `web/assets/gifs/.gitkeep` (symlink or copy-step pulls `demo/industry-<vertical>.gif` into `web/assets/gifs/` at deploy time)
- Create: `.github/workflows/deploy-web.yml` (on push to main: run `node web/data/build.mjs`, copy GIFs, deploy `web/` to `gh-pages` branch via `actions/deploy-pages`)
- Modify: `package.json` (add `web:build` script)
- Delete: `demo/index.html`, `demo/showcase.html`, `demo/industry-*.html` (8 files; rejected HTML mockups per `feedback_no_html_demos.md`)
- Modify: `README.md` (add showcase URL badge after the badges row)

**Definition of done:**
- `node web/data/build.mjs && python3 -m http.server -d web 8080` opens a working local showcase at all 7 verticals
- Selecting an industry instantly swaps brand block, theme swatch hexes, JSON snippet (brand + theme + first 3 KB categories), and the framed GIF
- Phone bezel is pure CSS, GIF is the actual recording (no simulated chat)
- GitHub Pages workflow green on first push; public URL live; badge in README links to it
- Old `demo/*.html` files deleted; `demo/*.gif` files retained
- Mobile-responsive (industry switcher works on narrow viewports)
- No em-dashes anywhere in `web/data/*.json` user-visible copy

**Routing:** Single session. All static assets, low risk of conflict, no parallelism gain.

---

## Phase 5 — `create-airgap-bot` scaffolder

**Goal:** `npx create-airgap-bot my-bot --template <industry>` produces a working RN project for any of the 7 verticals. Published to npm under a conflict-checked name.

**Files:**
- Create: `packages/create-airgap-bot/package.json` (bin entry → `dist/cli.js`; engines node ≥22; deps: minimal — `prompts`, `picocolors`, `tar` for tarball extract)
- Create: `packages/create-airgap-bot/src/cli.ts` (parses `--template <industry>` + bot name; defaults to interactive prompt if missing)
- Create: `packages/create-airgap-bot/src/scaffold.ts` (fetches release tarball from `github.com/xmpuspus/airgap` at a pinned tag, extracts to target dir, copies `examples/<template>/airgap.config.json` and `examples/<template>/knowledge/` over defaults)
- Create: `packages/create-airgap-bot/src/rename.ts` (rewrites Android package id, iOS bundle id, `app.json`, `package.json` `name` field, native `strings.xml`, native `Info.plist`)
- Create: `packages/create-airgap-bot/src/conflict-check.ts` (runs at publish-time: hits npm registry + GitHub `xmpuspus/airgap` repo; logs availability; falls back to `@xmpuspus/create-airgap-bot` if taken)
- Create: `packages/create-airgap-bot/test/scaffold.test.ts` (uses temp dir; runs scaffolder for each of 7 templates; asserts `npm install` succeeds in resulting tree; asserts `airgap.config.json` matches the chosen template)
- Create: `packages/create-airgap-bot/README.md` (install, usage, supported templates, known limitations)
- Create: `packages/create-airgap-bot/.npmignore` (excludes test/, src/, *.ts; ships only `dist/` + README + package.json)
- Create: `packages/create-airgap-bot/tsconfig.json`
- Create: `packages/create-airgap-bot/CHANGELOG.md` (v0.1.0 initial)
- Modify: root `package.json` (add `workspaces: ["packages/*"]`)
- Modify: `README.md` (add scaffolder install + usage section)
- Create: `.github/workflows/publish-create-airgap-bot.yml` (manual-trigger publish on release tag `create-airgap-bot-vX.Y.Z`; uses `NPM_TOKEN` secret)

**Definition of done:**
- `cd packages/create-airgap-bot && npm test` runs all 7 template scaffold tests green
- `npm link` then `create-airgap-bot test-bot --template healthcare` produces a working dir; `cd test-bot && npm install && npm run android` reaches chat screen in demo mode
- Conflict check runs in CI before publish; fallback name selected automatically if needed
- Package published to npm at v0.1.0
- README scaffolder section live with copy-paste install command
- All 7 templates verified end-to-end on at least one platform (CI matrix or local)

**Routing:** Subagent team in worktree, runnable in parallel with P6 (different dirs).
- agent A: `cli.ts` + `scaffold.ts` + tarball fetch
- agent B: `rename.ts` + native package id rewrites + per-platform fixtures
- agent C: tests across 7 templates + CI publish workflow

---

## Phase 6 — KB Studio Lite CLI

**Goal:** Interactive `node scripts/kb-studio.js` walks a non-engineer through CSV → validate → preview MiniSearch hits → export JSON → run journeys, against any of the 7 example KB dirs or a custom path.

**Files:**
- Create: `scripts/lib/kb.js` (extracted pure functions from existing `kb-validate.js` + `kb-import.js`: `parseCsv(path)`, `validateDocs(docs)`, `splitByCategory(docs)`, `exportToDir(docs, outDir)`)
- Modify: `scripts/kb-validate.js` (refactor to import from `scripts/lib/kb.js`; preserve current CLI behavior)
- Modify: `scripts/kb-import.js` (refactor to import from `scripts/lib/kb.js`; preserve current CLI behavior)
- Create: `scripts/kb-studio.js` (entrypoint; uses `prompts` for interactive flow: `path to CSV?` → `target industry?` → `preview hits for query?` → `export?` → `run journeys?`)
- Create: `scripts/lib/preview.js` (builds an in-memory MiniSearch index from a doc array, returns top-K hits for arbitrary query — no file I/O)
- Create: `scripts/lib/journeys.js` (wrapper around `__tests__/run-industry-tests.mjs` that runs against an arbitrary KB dir)
- Modify: `package.json` (add `kb:studio` script; add `prompts` dep if not built-in `readline` is too austere)
- Create: `__tests__/scripts/kb-studio.test.js` (unit: each lib function; integration: full studio flow against fixture CSV)
- Create: `docs/kb-studio.md` (how to use, supported CSV format, troubleshooting)
- Modify: `README.md` (add KB Studio one-liner under Customization section)
- Re-record: 30s screen capture of `npm run kb:studio` end-to-end (Asciinema or terminal-gif skill, NOT phone mockup)

**Definition of done:**
- `npm run kb:studio` walks an operator from a sample CSV through to a passing journey run on the chosen industry KB
- Existing `npm run kb:validate` and `npm run kb:import` still work unchanged (back-compat verified by existing tests)
- Test suite green
- Recording (terminal GIF, not phone) committed to `demo/kb-studio.gif` and linked from README
- Works against `examples/<vertical>/knowledge/` for all 7 verticals

**Routing:** Subagent team in worktree, parallel with P5.
- agent A: extract pure functions from existing scripts → `scripts/lib/kb.js`
- agent B: build interactive `kb-studio.js` + preview + journey runner
- agent C: tests + docs + recording

---

## P7 — Stretch (deferred, captured as separate items)

Per spec: "only if 1-6 land clean." If reached, each becomes its own ticket+PR:
- (S1) One backend connector per vertical: TM Forum (telco), BIAN (banking), FHIR R4 (healthcare), ACORD (insurance), CIM (utility), NDC (airline), local PUC (water). Minimal mocks under `server/<vertical>/`.
- (S2) Handoff packet: orchestrator emits `{summary, sources, queuedAction}` JSON when user requests escalation.
- (S3) Enterprise Readiness Matrix at `docs/enterprise-readiness.md` with per-vertical compliance slices (PDPA / HIPAA / PCI / NERC CIP / etc.).
- (S4) `docs/why-offline-support.md` rationale doc (engineering tone, no marketing language).

Not in scope for this plan. Capture in `LAUNCH.md` as follow-ups when P1–P6 close.

---

## Per-phase verification

Each phase's PR runs through:
1. `npx tsc --noEmit` clean
2. `npx eslint .` 0 errors (warnings carried only if pre-existing)
3. `npx jest` all green
4. `node __tests__/run-journeys.mjs` 100/100
5. `node __tests__/run-industry-tests.mjs` per-industry pass count unchanged or increased
6. Build verification: `npm run android` reaches chat screen on Pixel emulator; `npm run ios` reaches chat screen on iPhone simulator (in demo mode for iOS post-P1)
7. `/review --self` against the branch before opening PR per CLAUDE.md self-review rule
8. Frame-verify any re-recorded GIF (`ffmpeg -i x.gif -vf "select='eq(n,0)+eq(n,N)'" -vsync vfr /tmp/frame_%02d.png` then visually Read each frame)
9. Confirm zero LinkedIn / promotional language in commits, PR body, and any modified file (`grep -ri "linkedin\|wow factor\|demo reel"` returns empty)

---

## Final-effort verification (after P6 lands)

- All 7 templates work end-to-end on both platforms in demo mode
- All 7 templates have a passing journey run via KB Studio
- README updated: demo-mode 3-command quickstart, benchmark table, citation screenshot, public showcase URL, scaffolder install command, KB Studio recording
- `bench/results/` has at least one Pixel 6 emulator run
- `web/` deploys cleanly to GitHub Pages
- `create-airgap-bot` is published to npm and `npx create-airgap-bot demo-bot --template telco` works from any machine with node 22+
- Old `demo/*.html` rejected mockups deleted
- Zero LinkedIn / promotional language anywhere
- All recorded demos are real captures (frame-verified)
- `npx tsc --noEmit` clean, `npx eslint .` 0 errors, `npx jest` 110+ tests green
- `git log --oneline main..HEAD | wc -l` ≤ 7 (one merge commit per phase + minor follow-ups)

---

## Routing summary

| Phase | Routing | Worktree | Parallel? |
|---|---|---|---|
| P1 demo mode | Single session | yes | no |
| P2 benchmark | Subagent team (3 agents) | yes | no |
| P3 citations | Single session + `/frontend-design` + `/ui-ux-pro-max` | yes | no |
| P4 web showcase | Single session | yes | no |
| P5 scaffolder | Subagent team (3 agents) | yes | yes (with P6) |
| P6 KB Studio | Subagent team (3 agents) | yes | yes (with P5) |

After each phase merges: `/futureproof` after P1, P3 to find related patterns. `/commit` and `/pr` per CLAUDE.md self-review pipeline. Re-record demo GIFs after P1 (banner change), after P3 (citations visible), after P4 (showcase live, README screenshot updates).

---

## Critical files referenced (no edits needed beyond what's listed in each phase)

- `src/services/orchestrator.ts:380-427` — search+LLM path; demo formatter slots in here
- `src/services/searchService.ts` — KBDocument type (id, category, title, content, keywords, tags); add getDocumentById
- `src/components/chat/MessageBubble.tsx:456-468` — bubble footer; CitationChips insert here
- `src/types/chat.ts` — BotMessage.audit field already exists
- `src/services/llmRouter.ts:88` — current `config.llm.demo` check; migrates to `mode === 'demo'`
- `src/hooks/useModelDownload.ts:7,15` — already short-circuits on demo
- `airgap.schema.json:288-317` — `llm` block; `mode` enum gets `"demo"` added
- `examples/<vertical>/airgap.config.json` ×7 — all real, ready for `mode: "demo"` field
- `scripts/kb-validate.js`, `scripts/kb-import.js` — extract pure functions for P6
- `__tests__/journeys.ts` + `__tests__/multi-turn-journeys.ts` + `__tests__/run-industry-tests.mjs` — existing test pipeline; extend per phase

---

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| `create-airgap-bot` name taken on npm | Conflict check runs before publish; fallback to `@xmpuspus/create-airgap-bot` |
| Bench RAM measurement unreliable on emulator | First baseline run flagged as `emulator (approximate)`; physical-device row added later as separate ticket |
| Demo formatter loses streaming feel without LLM | Reuse existing `await sleep(30 + random*40)` token-by-token loop in demoLlmService; visually identical |
| GitHub Pages deploy permissions | Use `permissions: pages: write, id-token: write` in workflow; first PR may need manual Pages enablement |
| Scope creep into P7 | P7 items captured in `LAUNCH.md`, never bundled into P1–P6 PRs |
| Citation chips overflow on narrow screens | Max 3 chips visible + `+N more` overflow indicator opens drawer with full list |
| Renaming `llm.demo` boolean breaks existing example configs | Loader keeps back-compat alias; tests cover both old + new field |
