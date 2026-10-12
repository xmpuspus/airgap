# All five final GIF loops passed visual inspection

The recordings use source commit `94d094ed8f4e4d68db23ef58a5e89cf55b750849`.
Capture finished on 12 October 2026 at 23:41:57 UTC. Chromium 145.0.7632.6 and
Playwright 1.58.0 ran the actual application at 1280×900. Every export keeps the
full raw duration at normal speed, with no omitted ranges.
The [manifest](../../demo/public-service/recordings.json) binds code, styles, source
archives, model report, raw videos and exports to their exact hashes.

This capture followed the 2026-10-13 changes: a publisher on the three Palace records and the
holiday record, a government welcome list of the eight sourced topics, a government reply that
no longer streams, a checked-date age on the device calendar, a source drawer without the
saved-copy path and hash, and reruns of the host experiment with the same results. A reviewer
read
every contact sheet and each clip's beat list. No blank or broken recording frame blocked the
review.

| Clip             | Duration | Result                                                                                                      |
| ---------------- | -------: | ----------------------------------------------------------------------------------------------------------- |
| replay-pack      |  12.32 s | PASS. Shows the 26-case sequential run, 26/26 result and all cases.                                         |
| evidence-lab     |  17.80 s | PASS. Shows a Filipino question, the dated record, doubt recheck, source text and case download.            |
| source-workbench |  23.52 s | PASS. Shows the real historical change from 21 to 23 August 2024, then rollback to 21 August.               |
| model-controls   |  23.44 s | PASS. Shows recorded model text, token-limit stop, fallback status and the complete source-record reply.    |
| demo-kit         |  11.96 s | PASS. Shows the real reproduction command, prerequisites, code and corpus hashes, and source-pack download. |

The workbench distinguishes the signed proclamation from its dated covering memo.
The amendment uses the archived circular that reports the actual proclamation change.
Historical and local-only labels stay visible. The model view labels its outputs as
recorded results. Its failed retrieved-model fact checks and controlled fallbacks stay
visible. Browser playback does not call a model.

| Released GIF         | SHA-256                                                            |
| -------------------- | ------------------------------------------------------------------ |
| replay-pack.gif      | `8703fc0a42c5b298d8ef603e38c1c238789dbccb4d64b3fb4845fab33020aa12` |
| evidence-lab.gif     | `a74116c70b59552c26cc974bd39ec8c524758ac07e9e249d7f3dfbc2bff75429` |
| source-workbench.gif | `88e884885a2c91d0d3b39be7bb77926d9f7ba7435b2f4284f4cf15003b0b2184` |
| model-controls.gif   | `df9a56e4e07c5e4939fa455825ad3a766b86b7b491901869494eaa950c3c3dfe` |
| demo-kit.gif         | `70ff2b0ca7100a97354a8d3ebc63a3d9045595a7122150d1ce939530dd2376e5` |

## Earlier captures

The captures of 12 October 2026 at 17:03:14 UTC (source `b477b0c`), 17:27:47 UTC (source
`38d0faf`) and 17:49:29 UTC (source `86311fe`) passed this review before the last fixes. A capture at source `ee510bc` was replaced
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
