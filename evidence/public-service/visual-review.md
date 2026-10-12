# All five final GIF loops passed visual inspection

The recordings use source commit `86311fe14034a7833875cc0ade30e26a2e14610c`.
Capture finished on 12 October 2026 at 17:49:29 UTC. Chromium 145.0.7632.6 and
Playwright 1.58.0 ran the actual application at 1280×900. Every export keeps the
full raw duration at normal speed, with no omitted ranges.
The [manifest](../../demo/public-service/recordings.json) binds code, styles, source
archives, model report, raw videos and exports to their exact hashes.

This capture followed the 2026-10-13 changes: a publisher on the three Palace records and the
holiday record, a government welcome list of the eight sourced topics, a government reply that
no longer streams, a checked-date age on the device calendar, and reruns of the host experiment
with the same results. A reviewer read
every contact sheet and each clip's beat list. No blank or broken recording frame blocked the
review.

| Clip             | Duration | Result                                                                                                      |
| ---------------- | -------: | ----------------------------------------------------------------------------------------------------------- |
| replay-pack      |  12.32 s | PASS. Shows the 26-case sequential run, 26/26 result and all cases.                                         |
| evidence-lab     |  17.76 s | PASS. Shows a Filipino question, the dated record, doubt recheck, source text and case download.            |
| source-workbench |  23.48 s | PASS. Shows the real historical change from 21 to 23 August 2024, then rollback to 21 August.               |
| model-controls   |  23.40 s | PASS. Shows recorded model text, token-limit stop, fallback status and the complete source-record reply.    |
| demo-kit         |  12.48 s | PASS. Shows the real reproduction command, prerequisites, code and corpus hashes, and source-pack download. |

The workbench distinguishes the signed proclamation from its dated covering memo.
The amendment uses the archived circular that reports the actual proclamation change.
Historical and local-only labels stay visible. The model view labels its outputs as
recorded results. Its failed retrieved-model fact checks and controlled fallbacks stay
visible. Browser playback does not call a model.

| Released GIF         | SHA-256                                                            |
| -------------------- | ------------------------------------------------------------------ |
| replay-pack.gif      | `4c10f18cc2b14a7b2d5a3a16bc9adb6632547c28e6e15c77a558f6a24dac9d41` |
| evidence-lab.gif     | `d7a93088aaf255a766e3cf6ba4bb955b270c69feca50121e3b691a41a082692f` |
| source-workbench.gif | `e1b33a8d7e4aca23fd971af0aad167a0359f3f07dba44532318ece58d2a4385f` |
| model-controls.gif   | `718ee610fba9a436ae4a7c21bffc906f573ddb3ac6f8cfdaeb84fa6a85c70c72` |
| demo-kit.gif         | `f97576f2d60e7b7b4a067f5a3076fba06f9f09ee36bc8231d9aa82e1c976346f` |

## Earlier captures

The captures of 12 October 2026 at 17:03:14 UTC (source `b477b0c`) and 17:27:47 UTC (source
`38d0faf`) passed this review before the last fixes. A capture at source `ee510bc` was replaced
before review.

The capture of 12 October 2026 at 15:19:51 UTC, at source commit
`325c1acdf8f3f58b6bef6dc7d72c02379d623fd6`, passed the same review after the DICT records,
the `no_commentary` route and five new authored cases.

The capture of 9 October 2026 at source commit `f8c2411da69a0b64bb43a02384a6836e592b6393`
passed the same review with 21 cases and six records. Its desktop and mobile error-recovery
run, at 1280×900 and 390×844, covered the homepage, the five feature cards, lab, original
source, amendment, rollback, missing-file error, failed retry and successful recovery. The
[separate full reproduction](reproduction-review.md) passed the same checks in another
checkout. The 2026-10-12 capture reran the same browser journey and canonical QA before
export, and its HTTP checks matched the ten new GIF/MP4 files.

Raw videos, screenshots, downloads and loop-review frames stay in ignored run
directories. The [guide](../../docs/public-service-showcase.md) explains how to
create them. This review approves only the released hashes above. Separate
reproduction media keep their unreviewed flags. No fresh native-device run is implied.
