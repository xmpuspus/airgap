#!/usr/bin/env bash
set -euo pipefail

# Android hardware path for the Airgap bench harness. Requires:
#   - A running Pixel emulator (or physical device) visible to adb.
#   - Airgap app already installed and launched at least once so the
#     model file (gemma-4-e2b-it-q3ks.gguf) is present in the app
#     sandbox.
#   - The in-app bench harness wired to a deep link or an exported
#     Activity that responds to a benchmark intent. See
#     bench/README.md for the exact wiring (agent A owns that).
#
# This script is a thin orchestrator: device check -> trigger -> wait
# -> pull results. It does NOT build or install the app.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
RESULTS_DIR="${SCRIPT_DIR}/results"

PACKAGE="${AIRGAP_PACKAGE:-com.airgap}"
DEVICE_LABEL="${AIRGAP_BENCH_DEVICE:-pixel-emulator}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_PATH="${RESULTS_DIR}/pixel-${TIMESTAMP}.json"

if ! command -v adb >/dev/null 2>&1; then
  echo "[bench] adb not on PATH , install Android platform-tools" >&2
  exit 1
fi

# adb devices output: header line + one per device. Filter for "device"
# state (excludes "offline", "unauthorized", or empty rows).
DEVICE_COUNT="$(adb devices | awk 'NR>1 && $2=="device" {c++} END {print c+0}')"
if [[ "${DEVICE_COUNT}" -lt 1 ]]; then
  echo "[bench] no Android device/emulator detected. Start the Pixel" >&2
  echo "        emulator (~/Library/Android/sdk/emulator/emulator @<avd>)" >&2
  echo "        or attach a device, then re-run this script." >&2
  exit 1
fi

cd "${PROJECT_ROOT}"

# Trigger the in-app bench harness. Today this is a placeholder , the
# manual workaround until the deep-link wiring lands is documented in
# bench/README.md (build the dev variant, hit "Run benchmark" in the
# Settings screen, then re-run this script with --pull-only).
echo "TODO: trigger in-app bench harness via adb intent , see bench/README.md"
echo "[bench] pretending to wait for the device run to finish..."
echo "[bench] device label: ${DEVICE_LABEL}"
echo "[bench] expected output: ${OUT_PATH}"

# Pull results from the app sandbox. We use `run-as` because the
# results live under the package's private files dir on production
# builds. Debug builds may have them under /sdcard; the README covers
# both. The pull is best-effort: if the file is missing we exit 1
# with a hint pointing at the trigger step above.
SANDBOX_PATH="/data/data/${PACKAGE}/files/bench-result.json"
if adb shell "run-as ${PACKAGE} test -f ${SANDBOX_PATH}" 2>/dev/null; then
  adb shell "run-as ${PACKAGE} cat ${SANDBOX_PATH}" >"${OUT_PATH}"
  echo "[bench] pulled ${OUT_PATH}"
else
  echo "[bench] no result file at ${SANDBOX_PATH} yet , see bench/README.md" >&2
  echo "[bench] (this is expected until the in-app harness wiring lands)" >&2
  exit 1
fi
