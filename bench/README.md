# Airgap measurements run on named hardware

A small, reproducible set of scripts measures Airgap latency and throughput on real
devices. Operators run it on the hardware they plan to deploy and either
keep the results private or PR a row into the README table.

## Recorded latency and throughput

Each run captures four metrics.

- **First-token p50 (ms)** is the median time from request to the first
  emitted token. Reflects prompt processing plus the cold path through
  retrieval and the LLM.
- **Tokens/sec p50** is steady-state generation throughput once the model
  produces tokens.
- **Cold load (ms)** is the one-time cost to map the GGUF and initialize the
  llama.cpp context. Charged once per process.
- **Notes** contain free text for device RAM, OS build, thermal state, or any
  tweak that explains the numbers.

Demo mode runs use the deterministic formatter path, so tokens/sec is
recorded as `n/a (demo)`. First-token and cold load still measure real
work (search and output formatting) and are useful for catching regressions in the
non-LLM path.

## Run the measurement scripts

```bash
bash bench/run-node.sh       # local Node-side smoke and fastest signal
bash bench/run-android.sh    # Pixel-class device or Android emulator
bash bench/run-ios.sh        # iPhone simulator (real-device path is on the roadmap)
```

Each script writes `bench/results/<device-slug>-<YYYYMMDDTHHMMSSZ>.json`.
Re-running the same script does not overwrite earlier files. Every run produces
a fresh timestamped file so you can compare runs over time.

## The renderer updates the README table

```bash
node bench/render-table.mjs
```

The script walks `bench/results/`, picks the newest run per device,
sorts real-LLM rows alphabetically by device, then appends demo-mode
rows after, and replaces the content between
`<!-- BENCH START -->` and `<!-- BENCH END -->` in `README.md`. Running
twice in a row is a no-op. If the markers are missing the script exits
non-zero so CI catches the drift.

## Result files use one JSON schema

One JSON object per file. Needed keys follow.

| Key                  | Type                 | Notes                                                    |
| -------------------- | -------------------- | -------------------------------------------------------- |
| `device`             | string               | Display name shown in the table                          |
| `mode`               | `"real"` or `"demo"` | `real` runs the on-device LLM, `demo` runs the formatter |
| `model`              | string               | GGUF identifier. Use `"n/a"` for demo                    |
| `first_token_ms_p50` | number or null       | Median first-token latency in ms                         |
| `tokens_per_sec_p50` | number or null       | Steady-state throughput, ignored for demo                |
| `cold_load_ms`       | number or null       | Cold load time in ms                                     |
| `notes`              | string               | Optional free text                                       |

Files use the name `<device-slug>-<YYYYMMDDTHHMMSSZ>.json`. The
timestamp suffix is what the renderer uses to choose the newest run per
device, so keep it consistent.

## Add a new device row

1. Run the appropriate `bench/run-*.sh` on your device.
2. Check that `bench/results/` has your new file.
3. `node bench/render-table.mjs` to refresh the README table.
4. Commit both the result JSON and the regenerated README in the same PR.
5. In the PR body, mention the device, OS build, build type, and thermal state.

## Emulator measurements detect large regressions

Emulator runs are useful for catching gross regressions, but their RAM
and CPU numbers differ from physical hardware. Treat
emulator rows as a regression floor. Do not use them as a performance target.
Real-device support for iOS is tracked in the project roadmap. The iOS row reflects the
simulator path. Pixel hardware rows submitted by contributors are the
most representative real-LLM numbers in the table.

## Why the table currently has no Pixel + Gemma 4 row

The default Pixel AVD ships with a 5.8 GB userdata partition. After
Google Play Services and the airgap apk, the typical free-space window
is around 2.2 GB. The Gemma 4 E2B Q3_K_S GGUF is 2.3 GB, so it does
not fit on a stock AVD. Use one of these methods to add that row.

1. Resize the AVD's userdata partition (Android Studio, Edit AVD,
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
