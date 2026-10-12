# All five final GIF loops passed visual inspection

The recordings use source commit `b477b0c7ae3d4188ac65013aedf3e298d639c199`.
Capture finished on 12 October 2026 at 17:03:14 UTC. Chromium 145.0.7632.6 and
Playwright 1.58.0 ran the actual application at 1280×900. Every export keeps the
full raw duration at normal speed, with no omitted ranges.
The [manifest](../../demo/public-service/recordings.json) binds code, styles, source
archives, model report, raw videos and exports to their exact hashes.

This capture followed the 2026-10-13 change: a publisher on the three Palace records, a
government welcome list of the eight sourced topics, and a rerun of the host experiment with
the same results. A reviewer read every contact sheet and each clip's beat list. No blank or
broken recording frame blocked the review.

| Clip             | Duration | Result                                                                                                      |
| ---------------- | -------: | ----------------------------------------------------------------------------------------------------------- |
| replay-pack      |  12.32 s | PASS. Shows the 26-case sequential run, 26/26 result and all cases.                                         |
| evidence-lab     |  17.72 s | PASS. Shows a Filipino question, the dated record, doubt recheck, source text and case download.            |
| source-workbench |  23.52 s | PASS. Shows the real historical change from 21 to 23 August 2024, then rollback to 21 August.               |
| model-controls   |  23.40 s | PASS. Shows recorded model text, token-limit stop, fallback status and the complete source-record reply.    |
| demo-kit         |  11.96 s | PASS. Shows the real reproduction command, prerequisites, code and corpus hashes, and source-pack download. |

The workbench distinguishes the signed proclamation from its dated covering memo.
The amendment uses the archived circular that reports the actual proclamation change.
Historical and local-only labels stay visible. The model view labels its outputs as
recorded results. Its failed retrieved-model fact checks and controlled fallbacks stay
visible. Browser playback does not call a model.

| Released GIF         | SHA-256                                                            |
| -------------------- | ------------------------------------------------------------------ |
| replay-pack.gif      | `606bb6057b50bdff91896b14c6128d05b5aed20db75d2a72bc7f062fc27fc8c1` |
| evidence-lab.gif     | `00eae069f39e10abfb492d92917bc3053f462c7a3b5c61d70d9664b955ffabc5` |
| source-workbench.gif | `97e57cefc8f4a7e8617222c4f7fce3ed2fe2dc801f055d27ea2804d23e0eef30` |
| model-controls.gif   | `119ec09efc296a6019a3f3b5f31b32c81a6e35f1b76b36f029c47b4097cf13d2` |
| demo-kit.gif         | `5d88ffd8a0c4c9c4b13e70216e8890063b30c694f61db6afc75779c6035b7715` |

## Earlier captures

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
