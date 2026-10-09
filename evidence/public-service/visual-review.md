# All six screenshots and five GIF loops passed inspection

The recordings use source commit `fc909287c2bacd4a5f9e6642c877c61f75d28e21`.
The capture finished on 2026-10-09 at 05:40:14 UTC. Chromium 145.0.7632.6 ran
the actual application at 1280×900. Each GIF and MP4 preserves the full recorded
duration at normal speed. The [manifest](../../demo/public-service/recordings.json)
binds code, styles, sources, model report, raw video and derived exports to hashes.

Two read-only reviewers inspected the replay, lab, workbench and model clips.
The lead inspected the demo-kit clip. For each GIF, Chromium played the complete
animation through its loop boundary. Reviewers read all rendered-frame sheets
sampled every half-second, plus full-size state and transition frames.
Encoding success alone did not set the review flags.

| Clip             | Duration | Observed result                                                                                                |
| ---------------- | -------: | -------------------------------------------------------------------------------------------------------------- |
| Replay Pack      |  12.36 s | Shows 21/21 passed, all named cases and a clean loop restart                                                   |
| Evidence Lab     |  17.84 s | Shows a Filipino question, dated passport fee, doubt follow-up and source details. Model-called label stays no |
| Source Workbench |  23.56 s | Shows the historical date change from 21 August to 23 August 2024, then rollback to 21 August                  |
| Model Controls   |  23.44 s | Shows actual recorded NBI text ending at the token limit, then the complete source-record fallback             |
| Demo Kit         |  11.96 s | Shows the reproduction command, prerequisites, code and knowledge hashes, and source-pack download action      |

The workbench keeps the historical and local-only labels visible. It distinguishes
the attached original proclamation from the one-page circular reporting the amendment.
The model clip labels its content as recorded results. It does not imply a model call
during browser playback. Text is readable during the five-second reading holds.
All five loops return to their recorded starting view without a blank or broken frame.

| GIF                  | SHA-256                                                            |
| -------------------- | ------------------------------------------------------------------ |
| replay-pack.gif      | `d0d26072efea113877094c0d073368be81cf4151ed7601047e5d8864fc5abfa4` |
| evidence-lab.gif     | `e47a9244c0cefda24efd161f4d9d3fa1ec50909d1b2edb2cec4dceb5b74ac286` |
| source-workbench.gif | `74fcaac9f1f41c28555ddf573b3424b891a2ac453ac3e7f74cd5faf177454287` |
| model-controls.gif   | `f1867cc70d89c7ea5204b88bedd2cc358b50d01c9da56219d7fb009f20e4039e` |
| demo-kit.gif         | `6f1501f520c8da78335f0752f2a94e75e135fe7a7550c29711f53500f9dc23be` |

## Desktop and mobile views keep sources and metrics visible

Independent screenshot inspection covered the lab, workbench and experiment at
1280×900 and 390×844. The final capture QA run finished at 05:38:27 UTC and produced
the same six image hashes as the inspected run. Both widths have zero horizontal
overflow and no page errors. Each width submits all 21 cases, repeats replay twice,
runs free-form and doubt queries, applies and rolls back the amendment, and checks
four downloaded JSON files.

| Screenshot          | SHA-256                                                            |
| ------------------- | ------------------------------------------------------------------ |
| lab-1280.png        | `02876b56dc36fba57b887b8d54945fa19ae5746a83210b691946832948c27cf4` |
| lab-390.png         | `b143ba07813e9696f75e8dc9dd9aad1a14aea8d473d27d658d0a862d00f3e2db` |
| workbench-1280.png  | `c63702f0154a7cd6b8032b67cf728449a4198725a77f61f8e08d39757cc48c7e` |
| workbench-390.png   | `80c45b491f062594c555a2b8de8cabe8e0e6964d45b4a51c10824ff46729ddd8` |
| experiment-1280.png | `aee7b97164ecf59ce73509e8113c53afe5de9718650a42244b3a7c107499f94e` |
| experiment-390.png  | `77f985b344622de15fd98db1be275930ebc843cd8aac1d317bbee4f51ea3d4a7` |

Raw videos, screenshots and loop-review frames stay in ignored run directories.
The [reproduction guide](../../docs/public-service-showcase.md) explains how to create your own.
Earlier failed inspections and captures stay in Git history or preserved run
directories. This review approves only the hashes above. It makes no native-device claim.
