# Checks recorded for the reviewed capture source

This table describes the reviewed capture source below. It is not a current-source
acceptance receipt. The October 9 review corrections to historical date labels and
browser recovery coverage require a new capture and independent visual inspection.

The reviewed capture source is `fc909287c2bacd4a5f9e6642c877c61f75d28e21`.
The core is SHA-256 `1633ec0bfc058932d6e43bb78a5c2967ddd80d99f2c8616531b796dee95531cd`.
The final model report is SHA-256
`f7ef2b355b088ae9d785549b7337966fa4828a4628d16b73ed45c92bfd1be86c`.
Its [independent review](experiment-review.md) covers every displayed answer and raw output.

| Check                                              | Observed result on 2026-10-09                                                                                  |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Frozen replay entrypoint                           | PASS: 21 cases, including all 15 original government queries                                                   |
| Core and CLI tests                                 | PASS: 11 tests, including incomplete evidence and both historical source orders                                |
| Capture recovery tests                             | PASS: four tests using real media bytes and filesystem operations                                              |
| Industry runner                                    | PASS: 77 checks across eight templates                                                                         |
| Jest                                               | PASS at the capture source; run `npm test -- --runInBand` for current totals                                   |
| Types, ESLint and formatting                       | PASS                                                                                                           |
| Knowledge validation and local documentation links | PASS                                                                                                           |
| `public:verify`                                    | PASS: source bytes, 54 experiment rows, timings, decisions and five reviewed captures                          |
| `recordings:validate`                              | PASS: 16 existing release recordings plus five public-service browser clips                                    |
| Browser QA                                         | PASS: all 21 cases at both widths, two replays, free-form and doubt, source apply and rollback, JSON downloads |
| Visual review                                      | PASS: six screenshots and all five full GIF loops                                                              |

The full `public:demo` command completed replay, 36 real model generations, site build,
browser QA and five captures. Its model report used source commit
`ce12f1e19ec042b8a3f48c042fe661c4780bfe16`.
The final capture-only run used the source above and the same checked report.
It records the workbench's state before its first answer and validates every beat before
publishing the files. The [visual review](visual-review.md) lists the final media hashes.

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

The full audit reports 63 dependency entries: 0 critical, 56 high and 7 moderate.
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
2026 Proclamation 1006 record and verifies selection in either order. Its catalogue
rollover metadata is authored application configuration, not a claim of legal amendment.
All 13 core tests passed with the real clock on 2026-10-09. Current records need source
review before their maintainer deadlines expire.

The frozen checker remains SHA-256
`36058f62e6b496d4a186e044ef7760afde1744bde88d04f5c022a4af36aed5ec`.
The work is committed locally. No agency transaction, deployment or external publication
is part of this evidence.
