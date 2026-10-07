# Measured latency per device

`node bench/render-table.mjs` rebuilds the table below from the newest result file per device in
`bench/results/`. Do not edit the rows by hand.

<!-- BENCH START -->
| Device | Mode | Model | First-token (p50 ms) | Tokens/sec (p50) | Cold load (ms) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| mac-host-gemma3-fixture | real | hf_bartowski_google_gemma-3-1b-it-Q4_K_M.gguf | 29 | 84.5 | 610.8 | fixture (Gemma 3 1B Q4), not Gemma 4 |
| mac-host-node | demo | gemma-4-e2b-it-q3ks.gguf | 0.6 | n/a (demo) | n/a |  |
<!-- BENCH END -->

A `demo` row measures search and output formatting only. A `real` row measures the on-device
model. The Notes column records the model file, so a fixture run is never read as Gemma 4 data.
