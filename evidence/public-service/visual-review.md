# All five final GIF loops passed visual inspection

The recordings use source commit `f8c2411da69a0b64bb43a02384a6836e592b6393`.
Capture finished on 9 October 2026 at 07:23:44 UTC. Chromium 145.0.7632.6 and
Playwright 1.58.0 ran the actual application at 1280×900. Every export keeps the
full raw duration at normal speed, with no omitted ranges.
The [manifest](../../demo/public-service/recordings.json) binds code, styles, source
archives, model report, raw videos and exports to their exact hashes.

The lead inspected replay, evidence-lab and demo-kit. An independent reviewer inspected
source-workbench and model-controls. Each GIF played in Chromium through a complete
cycle and its loop boundary. Reviewers read every rendered-frame sheet sampled at
half-second intervals, plus full-size state and seam frames. The reading holds last
five seconds. No blank or broken recording frame blocked the review.

| Clip             | Duration | Result                                                                                                      |
| ---------------- | -------: | ----------------------------------------------------------------------------------------------------------- |
| replay-pack      |  12.44 s | PASS. Shows the 21-case sequential run, 21/21 result, all cases and loop restart.                           |
| evidence-lab     |  18.04 s | PASS. Shows a Filipino question, dated passport fee, doubt recheck, source text and case download.          |
| source-workbench |  23.84 s | PASS. Shows the real historical change from 21 to 23 August 2024, then rollback to 21 August.               |
| model-controls   |  23.44 s | PASS. Shows recorded model text, token-limit stop, fallback status and the complete source-record reply.    |
| demo-kit         |  12.08 s | PASS. Shows the real reproduction command, prerequisites, code and corpus hashes, and source-pack download. |

The workbench distinguishes the signed proclamation from its dated covering memo.
The amendment uses the archived circular that reports the actual proclamation change.
Historical and local-only labels stay visible. The model view labels its outputs as
recorded results. Its failed retrieved-model fact check and controlled fallback stay
visible. Browser playback does not call a model.

| Released GIF         | SHA-256                                                            |
| -------------------- | ------------------------------------------------------------------ |
| replay-pack.gif      | `c48be6a84857148527faf0a4ecb4259422f52030707bdadc2547d2583135c51d` |
| evidence-lab.gif     | `e018891db242be4108dab3120e162b1e1c9549d248f4fa9a294eafe2d3f77eb4` |
| source-workbench.gif | `d2abcfc43f289c8dce2b5c6b0559ba57139637a7f3a688a5eb1a67600a583215` |
| model-controls.gif   | `bfe67b88a8d3690e775bae4a5fae78b841822aac923784b2ce04ce458eb13b5f` |
| demo-kit.gif         | `59386249130e6f6673528c6813d61c743dad1940f12a2aa5d24c2793c3a7e108` |

## Desktop and mobile error recovery passed independent inspection

A separate host browser run finished at 07:24:32 UTC on 9 October 2026, using the
same core, HTML, JavaScript, styles and public data pack as the final capture.
The reviewer read all 18 PNGs at 1280×900 and 390×844. They cover the homepage,
the five feature cards, lab, original source, amendment, rollback, missing-file
error, failed retry and successful recovery.

The recovery server returned real HTTP 404 responses while the source pack was
absent. After the exact bytes returned, keyboard retry loaded the pack and answered
the passport-fee question. The reviewer read both downloaded case files and checked
their hashes and `modelCalled: false` values. Neither viewport clips its controls or
overflows horizontally. The source dates and unavailable-agency limits are readable.

The final canonical QA finished at 07:24:06 UTC after capture. It drove every case,
two replays, free-form and doubt, source apply and rollback, and four JSON downloads
at each width. Its final HTTP checks matched the ten new GIF/MP4 files and all nine
existing site GIFs. The [separate full reproduction](reproduction-review.md) passed
the same checks in another checkout.

Raw videos, screenshots, downloads and loop-review frames stay in ignored run
directories. The [guide](../../docs/public-service-showcase.md) explains how to
create them. This review approves only the released hashes above. Separate
reproduction media keep their unreviewed flags. No fresh native-device run is implied.
