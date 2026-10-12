# All five final GIF loops passed visual inspection

The recordings use source commit `325c1acdf8f3f58b6bef6dc7d72c02379d623fd6`.
Capture finished on 12 October 2026 at 15:19:51 UTC. Chromium 145.0.7632.6 and
Playwright 1.58.0 ran the actual application at 1280×900. Every export keeps the
full raw duration at normal speed, with no omitted ranges.
The [manifest](../../demo/public-service/recordings.json) binds code, styles, source
archives, model report, raw videos and exports to their exact hashes.

This capture followed the 2026-10-12 record and core change: two Palace releases on the
DICT resignation and the alleged ghost internet projects, the `no_commentary` route, and
five new authored cases. A reviewer read every contact sheet, sampled at one sixth of each
clip, and extra frames where a sheet left a beat unclear. No blank or broken recording
frame blocked the review.

| Clip             | Duration | Result                                                                                                      |
| ---------------- | -------: | ----------------------------------------------------------------------------------------------------------- |
| replay-pack      |  12.32 s | PASS. Shows the 26-case sequential run, 26/26 result, all cases and loop restart.                           |
| evidence-lab     |  17.76 s | PASS. Shows a Filipino question, the dated record, doubt recheck, source text and case download.            |
| source-workbench |  23.56 s | PASS. Shows the real historical change from 21 to 23 August 2024, then rollback to 21 August.               |
| model-controls   |  23.44 s | PASS. Shows recorded model text, token-limit stop, fallback status and the complete source-record reply.    |
| demo-kit         |  11.96 s | PASS. Shows the real reproduction command, prerequisites, code and corpus hashes, and source-pack download. |

The workbench distinguishes the signed proclamation from its dated covering memo.
The amendment uses the archived circular that reports the actual proclamation change.
Historical and local-only labels stay visible. The model view labels its outputs as
recorded results. Its failed retrieved-model fact checks and controlled fallbacks stay
visible. Browser playback does not call a model.

| Released GIF         | SHA-256                                                            |
| -------------------- | ------------------------------------------------------------------ |
| replay-pack.gif      | `d41e47045b187ae99af7e09852a7469805a2e6dca3205d265168d4c9214a25c6` |
| evidence-lab.gif     | `87207578fba350f8f18dbebd443a8f8c4c4aead10901e45e8ee349ebaa087916` |
| source-workbench.gif | `09a77d54c2d4501c0d4caba3b69ec4d2a90f6bd90ea65d8107c91ce585a1c181` |
| model-controls.gif   | `f4b0fd5b9da29962a932abfa9cd17b477e694dc9c4be7762e43aedb05cdaae63` |
| demo-kit.gif         | `66c4d7c6ed8ac607583b7d6597a336fce3f63962372f169ebf881603040ac627` |

## Earlier captures

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
