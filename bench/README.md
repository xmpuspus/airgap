# Airgap latency measurements

The scripts in this folder measure Airgap latency with a fixed query set. The Node runner works
on any machine with the repository installed. Device runs use the same harness module from inside
a development build. Results go to [`RESULTS.md`](RESULTS.md).

## Each run records four numbers

- **First-token p50 (ms)**: the median time from request to the first emitted token. It includes
  retrieval and prompt processing.
- **Tokens/sec p50**: steady-state generation throughput after the first token.
- **Cold load (ms)**: the one-time cost to map the model file and initialize the runtime context.
- **Notes**: free text for device RAM, OS build, thermal state, or the model file in use.

Demo mode has no model, so the table shows tokens/sec as `n/a (demo)`. First-token time still
measures search and output formatting, which catches regressions in the no-model path.

## Run the Node measurement

```bash
bash bench/run-node.sh
```

The script runs the queries in `bench/queries.json` through the demo pipeline and writes
`bench/results/node-<YYYYMMDDTHHMMSSZ>.json`. Each run writes a new file. Set
`AIRGAP_BENCH_DEVICE` to change the device label.

## Run the harness on a device

`src/dev/benchHarness.ts` exports `runBench(queries)`. It drives each query through the
orchestrator and returns the same result shape as the Node runner. Call it from a development
build, write the returned object to a file named `<device-slug>-<YYYYMMDDTHHMMSSZ>.json`, and copy
that file into `bench/results/`. The repository includes no script that triggers the harness over
`adb` or the iOS Simulator.

## The renderer updates the results page

```bash
node bench/render-table.mjs
```

The script reads `bench/results/`, keeps the newest run per device, sorts real-model rows by device
name, then adds demo rows, and replaces the block between `<!-- BENCH START -->` and
`<!-- BENCH END -->` in `bench/RESULTS.md`. A second run changes nothing. If the markers are
missing, the script exits with code 1.

## Result files use one JSON shape

One JSON object per file. The renderer reads these keys.

| Key       | Type                 | Notes                                                                      |
| --------- | -------------------- | -------------------------------------------------------------------------- |
| `device`  | string               | Display name shown in the table                                            |
| `mode`    | `"real"` or `"demo"` | `real` runs the on-device model, `demo` runs the formatter                 |
| `model`   | string               | Model file name, or `"n/a"` for demo                                       |
| `runs`    | array                | One `{loadMs, firstTokenMs, tokensPerSec, totalMs, tokenCount}` per query  |
| `summary` | object               | `p50FirstTokenMs`, `p95FirstTokenMs`, `p50TokensPerSec`, `p95TokensPerSec` |
| `notes`   | string               | Optional free text                                                         |

The renderer also accepts the older keys `first_token_ms_p50`, `tokens_per_sec_p50`, and
`cold_load_ms`. The timestamp suffix in the file name decides which run is newest.

## Add a device row

1. Produce a result file on the device.
2. Copy it into `bench/results/`.
3. Run `node bench/render-table.mjs`.
4. Commit the result file and `bench/RESULTS.md` together.
5. In the pull request, give the device, OS build, build type, and thermal state.

## Emulator numbers show regressions, not device speed

Emulator RAM and CPU differ from a phone. Treat an emulator row as a regression floor, never as
a performance target. The table has no Gemma 4 E2B row yet. The stock Pixel image leaves about
2.2 GB free after Google Play services and the app, and the Gemma 4 E2B Q3_K_S file needs
2.3 GB, so the model does not fit without a larger storage setting. The laptop fixture row uses a
Gemma 3 1B file because the Node runtime in use did not read the Gemma 4 architecture. The Notes
column records the model file, so a fixture run is never read as Gemma 4 data.
