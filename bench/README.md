# Airgap Benchmark Harness

A small, reproducible harness for measuring how Airgap performs on real
devices. Operators run it on the hardware they plan to deploy and either
keep the results private or PR a row into the README table.

## What this measures

Each run captures four metrics:

- **First-token p50 (ms)**: median time from request to the first
  emitted token. Reflects prompt processing plus the cold path through
  retrieval and the LLM.
- **Tokens/sec p50**: steady-state generation throughput once the model
  is producing tokens.
- **Cold load (ms)**: one-time cost to map the GGUF and initialize the
  llama.cpp context. Charged once per process.
- **Notes**: free text for device RAM, OS build, thermal state, or any
  tweak that explains the numbers.

Demo mode runs use the deterministic formatter path, so tokens/sec is
recorded as `n/a (demo)`. First-token and cold load still measure real
work (search, render) and are useful for catching regressions in the
non-LLM path.

## How to run

```bash
bash bench/run-node.sh       # local Node-side smoke; fastest signal
bash bench/run-android.sh    # Pixel-class device or Android emulator
bash bench/run-ios.sh        # iPhone simulator (real-device path is on the roadmap)
```

Each script writes `bench/results/<device-slug>-<YYYYMMDDTHHMMSSZ>.json`.
Re-running the same script overwrites nothing: every invocation produces
a fresh timestamped file so you can compare runs over time.

## How rows get into the README

```bash
node bench/render-table.mjs
```

The script walks `bench/results/`, picks the newest run per device,
sorts real-LLM rows alphabetically by device, then appends demo-mode
rows after, and replaces the content between
`<!-- BENCH:START -->` and `<!-- BENCH:END -->` in `README.md`. Running
twice in a row is a no-op. If the markers are missing the script exits
non-zero so CI catches the drift.

## Format of `bench/results/*.json`

One JSON object per file. Required keys:

| Key | Type | Notes |
| --- | --- | --- |
| `device` | string | Display name; appears in the table |
| `mode` | `"real"` or `"demo"` | `real` runs the on-device LLM, `demo` runs the formatter |
| `model` | string | GGUF identifier; use `"n/a"` for demo |
| `first_token_ms_p50` | number or null | Median first-token latency in ms |
| `tokens_per_sec_p50` | number or null | Steady-state throughput; ignored for demo |
| `cold_load_ms` | number or null | Cold load time in ms |
| `notes` | string | Optional free text |

Filename convention: `<device-slug>-<YYYYMMDDTHHMMSSZ>.json`. The
timestamp suffix is what the renderer uses to select the newest run per
device, so keep it consistent.

## Adding a new device row

1. Run the appropriate `bench/run-*.sh` on your device.
2. Confirm `bench/results/` contains your new file.
3. `node bench/render-table.mjs` to refresh the README table.
4. Commit both the result JSON and the regenerated README in the same PR.
5. In the PR body, mention the device, OS build, and how the run was
   executed (debug build, release build, thermal state).

## A note on emulator measurements

Emulator runs are useful for catching gross regressions but their RAM
and CPU numbers are approximate compared to physical hardware. Treat
emulator rows as a floor, not a target. Real-device support for iOS is
tracked in the project roadmap; for now the iOS row reflects the
simulator path. Pixel hardware rows submitted by contributors are the
most representative real-LLM numbers in the table.

## Why the table currently has no Pixel + Gemma 4 row

The default Pixel AVD ships with a 5.8 GB userdata partition. After
Google Play Services and the airgap apk, the typical free-space window
is around 2.2 GB. The Gemma 4 E2B Q3_K_S GGUF is 2.3 GB, so it does
not fit on a stock AVD. Two ways to populate that row:

1. Resize the AVD's userdata partition (Android Studio: Edit AVD,
   Show Advanced Settings, increase Internal Storage to >=8 GB),
   wipe data, reinstall the app, then `bash bench/run-android.sh`.
2. Run on a real Pixel device (phone-class, 6 GB+ RAM) and
   `bash bench/run-android.sh`. The script trips on `adb devices`
   first to surface a clear error if the device is not connected.

The laptop fixture row uses Gemma 3 1B Q4 because node-llama-cpp
3.18.1's bundled llama.cpp does not yet understand the gemma4
architecture (the on-device llama.rn runtime does). The Notes column
on each row records that distinction so a fixture run can never be
mistaken for real Gemma 4 numbers.
