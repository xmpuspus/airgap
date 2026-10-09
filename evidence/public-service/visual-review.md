# The first host captures require replacement

In the earlier inspection, a read-only agent inspected six actual screenshots under
`tmp/public-showcase/browser/`: lab, workbench and experiment at 1280px and 390px.
It also read all five contact sheets under
`tmp/recordings/public-service/20261009T043410Z/`. This was image inspection, not a
full-loop approval. The lead additionally read the mobile experiment screenshot and
model-controls contact sheet. No review flag was set.

The desktop lab and workbench show the answers, routes, sources and replay results.
Mobile experiment metrics lose columns in the internal scroller. Raw JSON and hashes
are too small to read. The model clip opens `president / record-only / run 1`, whose
`rawOutput` is null, despite a beat label claiming raw model output.

The observed clips last 4.2 seconds for replay, 5.6 for the lab, 7.2 for workbench and
3.8 each for model controls and the kit. The dense content needs more reading time.
The workbench clip also predates packaging of the actual Customs/BIR PDFs.

The source changes address these findings with responsive metric cards, readable raw
text, a real incomplete NBI model row and its fallback, and five-second reading holds.
All five clips require new capture because source/model/UI identity changed. Fresh
screenshots and full loops must be inspected before any approval. The previous files
remain actual earlier recordings with `loopReviewed: false`.

## Later host screenshots expose all mobile metrics

The host QA run started at 2026-10-09T04:57:32Z and replaced the six screenshots in
`tmp/public-showcase/browser/`. A fresh read-only agent opened all six in this attempt.
The lead also opened the mobile experiment image. The run identifies Chromium
145.0.7632.6 and prior core
`d1fc4c9c8572688aaa64986e505a3a90f7d42c8d3be93fa14464bf94d1303a7f`.

The mobile experiment now uses stacked cards with model calls and p95 values visible.
Raw outputs are readable and scroll vertically. Lab navigation, source metadata and
workbench controls wrap without visible clipping or overlap. The experiment shows actual
NBI model text and the controlled record fallback. Desktop screenshots show the source
excerpt and hashes, 21/21 replay, and the distinction between the attached original
proclamation and the circular reporting the amendment.

The mobile experiment PNG is SHA-256
`414c4715d2fd4b201a766dc0f75bd5c0b0032c55bef9c609571338a1b7129ef5`.
These observations address the earlier layout findings. They do not verify the subsequent
core changes or approve any GIF loop. All five recordings still require replacement and
full-loop inspection after committed-source capture.
