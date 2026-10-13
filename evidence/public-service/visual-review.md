# All five final GIF loops passed visual inspection

The recordings use source commit `4ddf897450736b8c8c59177fd7224f3498004062`.
Capture finished on 13 October 2026 at 03:23:51 UTC. Chromium 145.0.7632.6 and
Playwright 1.58.0 ran the application at 1280×900. Every export keeps the
full raw duration at normal speed, with no omitted ranges.
The [manifest](../../demo/public-service/recordings.json) binds code, styles, source
archives, model report, raw videos and exports to their exact hashes.

This capture shows the lab with the 26 prompts labeled as test cases, a publisher on the three
Palace records and the holiday record, the age of each checked date, and a source drawer with
the publisher and link. The host experiment was rerun with the same results. Every contact
sheet and each clip's beat list was read. No blank or broken recording frame blocked the
review.

| Clip             | Duration | Result                                                                                                   |
| ---------------- | -------: | -------------------------------------------------------------------------------------------------------- |
| replay-pack      |  12.32 s | PASS. Shows the 26-case sequential run, 26/26 result and all cases.                                      |
| evidence-lab     |  17.76 s | PASS. Shows a Filipino question, the dated record, doubt recheck, source text and case download.         |
| source-workbench |  23.52 s | PASS. Shows the historical change from 21 to 23 August 2024, then rollback to 21 August.                 |
| model-controls   |  23.44 s | PASS. Shows recorded model text, token-limit stop, fallback status and the complete source-record reply. |
| demo-kit         |  11.96 s | PASS. Shows the reproduction command, prerequisites, code and corpus hashes, and source-pack download.   |

The workbench distinguishes the signed proclamation from its dated covering memo.
The amendment uses the archived circular that reports the proclamation change.
Historical and local-only labels stay visible. The model view labels its outputs as
recorded results. Its failed retrieved-model fact checks and controlled fallbacks stay
visible. Browser playback does not call a model.

| Released GIF         | SHA-256                                                            |
| -------------------- | ------------------------------------------------------------------ |
| replay-pack.gif      | `9ca75fc535fb8c920c8d37ab96295fac0bda4d07d0449eb266d491270d3a9ade` |
| evidence-lab.gif     | `41260426c0d895c54f1ad5ec9da7fb81e2822ef3ad2d62ecafccd62247b0cb46` |
| source-workbench.gif | `8b616f43f9c92140d2b5fab8cbf7808b8e5222053038aafce422c6e2444bd10d` |
| model-controls.gif   | `820b1a50a0a6c849150011bc3b0302a9a628cfc34b3dd071a57041d33fade072` |
| demo-kit.gif         | `ab5e9bf283f1c9704b9f97e4db3eee779c9ebf311b8c540fa1410b2971552d86` |

Raw videos, screenshots, downloads and loop-review frames stay in ignored run
directories. The [guide](../../docs/public-service-showcase.md) explains how to
create them. This review approves only the released hashes above. Separate
reproduction media keep their unreviewed flags.
