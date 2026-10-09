# The local checks pass at the recorded source

The final capture source is `f8c2411da69a0b64bb43a02384a6836e592b6393`.
The core is SHA-256 `c9a825df630040722a8417d26b32e2a7acf938a5f4416ac08b7d39c527f41550`.
The released model report is SHA-256
`f158fd1e6cf3942f3635435b654da54c7055a28d46114560b42ef74424235e53`.
The [independent model review](experiment-review.md) covers all 54 displayed answers
and 36 raw outputs. All 18 controlled answers use the source-record fallback.

| Check                                              | Result on 2026-10-09                                                                                                    |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Frozen replay entrypoint                           | PASS, 21 cases including all 15 original government queries                                                             |
| Core and CLI tests                                 | PASS, 13 tests including explicit years, expiry and both source orders                                                  |
| Capture recovery tests                             | PASS, four tests using real media and filesystem operations                                                             |
| Jest                                               | PASS, run `npm test -- --runInBand` for current totals                                                                  |
| Types, ESLint and formatting                       | PASS                                                                                                                    |
| Knowledge validation and local documentation links | PASS                                                                                                                    |
| Browser QA                                         | PASS, all cases, repeat replay, free-form and doubt, apply and rollback, downloads, failure and recovery at both widths |
| `public:verify`                                    | PASS, source bytes, all 54 experiment rows, timing, controls and five reviewed captures                                 |
| `recordings:validate`                              | PASS, 16 existing release recordings                                                                                    |
| Visual inspection                                  | PASS, 18 current desktop/mobile screenshots and all five final GIF loops                                                |

The full regression run passed 595 tests in 64 suites. Browser QA finished at
07:24:06 UTC after the final captures. Both viewport sizes fetched the ten new
GIF/MP4 files and nine existing site GIFs with matching source hashes.

The final `public:capture` process completed with exit 0. Its complete process
capture has SHA-256 `d685b9ff433126e9132962ff4c76b7114718dd04e309d4f6a0946e6350017ddf`.
The full `public:demo` command then passed in a separate checkout at the same source.
That [independent reproduction](reproduction-review.md) includes 36 new model
generations and a final browser pass against its newly captured media.
It reused installed dependencies and the existing CPU binding.

The released model report comes from the actual run against
`a8f688f99148e00123a708ba0940638214511f3d`. Later packaging changes leave its
core, corpus, runner, criteria and policy hashes unchanged. The final capture uses
that reviewed report. The separate reproduction has its own report and media.
The [visual review](visual-review.md) gives the exact released GIF hashes.

Government requests cannot create mock transactions. New queue requests are rejected.
Stored requests fail with `no_agency_integration`, display “Unavailable,” and offer only
removal. Tests use the actual queue, government configuration and loaded public records.
Configured safety, greetings, device-local time and refusal-then-doubt behavior pass their
integration checks. Service date questions cannot borrow the device clock.

Capture stages all five clips and ten exports before replacing the release directory.
The script keeps the earlier set and restores it if a rename fails. Model reports also use
atomic replacement after saving the immutable run output. No source dates, model answers,
provider responses, metrics or media frames were fabricated. Raw recordings and models
stay outside Git.

## Dependency overrides remove the critical findings

The installed graph uses shell-quote 1.11.0, simple-git 4.0.1 and
@simple-git/argv-parser 2.0.1, with node-llama-cpp still pinned to 3.18.1.
The parser patch addresses the
[unsafe VISUAL editor classification](https://github.com/advisories/GHSA-v5rq-49vh-5v5c).
Read-only API checks passed, and the updated graph loaded the local CPU model and
completed all 36 generations.

The 9 October audit reports 63 dependency entries: 0 critical, 56 high and 7 moderate.
Excluding development dependencies gives 41: 0 critical, 34 high and 7 moderate.
The audit counts entries without testing exploitability. The static lab imports local code
and data. High and moderate advisories still apply to the wider React Native and development tree.

This run reused the existing CPU binding. It did not compile llama.cpp from source.

## The evidence covers a bounded local example

The six-question experiment uses Gemma 3 1B Q4_K_M on an Apple M5 CPU host.
It does not measure general model quality, phone performance or Gemma 4 behavior.
The pinned runner cannot load the supplied Gemma 4 architecture. There was no fresh
native-device run. Existing native recordings keep their separate identities.

The historical revision pair is tested in both orders. The real 2025 Proclamation 727
calendar now tests refusal after its annual scope ends. The same test adds the checked
2026 Proclamation 1006 record and checks the selected record in either order. An explicit
2025 query must still refuse the expired record. It cannot borrow the 2026 answer.

Its catalogue
rollover metadata is authored application configuration, not a claim of legal amendment.
All 13 core tests passed with the real clock on 2026-10-09. Current records need source
review before their maintainer deadlines expire.

The frozen checker remains SHA-256
`36058f62e6b496d4a186e044ef7760afde1744bde88d04f5c022a4af36aed5ec`.
The work is committed locally. No agency transaction, deployment or external publication
is part of this evidence.
