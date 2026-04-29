#!/usr/bin/env bash
set -euo pipefail

# iOS simulator path for the Airgap bench harness. Demo mode only on
# iOS , real Gemma 4 E2B inference is not currently exercised on the
# simulator (Metal/CoreML wiring is Android-emulator-only for now).
# Sister of bench/run-android.sh.
#
# Requires:
#   - A booted iOS Simulator with the Airgap app installed.
#   - The in-app bench harness reachable via a custom URL scheme or
#     a debug menu , see bench/README.md.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
RESULTS_DIR="${SCRIPT_DIR}/results"

DEVICE_LABEL="${AIRGAP_BENCH_DEVICE:-iphone-simulator}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_PATH="${RESULTS_DIR}/ios-${TIMESTAMP}.json"

if ! command -v xcrun >/dev/null 2>&1; then
  echo "[bench] xcrun not on PATH , install Xcode command line tools" >&2
  exit 1
fi

# `xcrun simctl list devices booted` prints "-- iOS XX.Y --" sections
# with one row per booted simulator. A trailing "(Booted)" marks live
# devices. Filter for those rows; bail if none.
BOOTED_COUNT="$(xcrun simctl list devices booted | grep -c 'Booted' || true)"
if [[ "${BOOTED_COUNT}" -lt 1 ]]; then
  echo "[bench] no booted iOS simulator detected." >&2
  echo "        Boot one via: xcrun simctl boot 'iPhone 15 Pro'" >&2
  echo "        Then install the Airgap app and re-run this script." >&2
  exit 1
fi

cd "${PROJECT_ROOT}"

# Trigger the in-app bench harness. Placeholder until the URL-scheme
# wiring lands , agent A owns that. README documents the manual
# workaround (open the app, tap Settings -> Run benchmark, wait, then
# re-run this script with --pull-only).
echo "TODO: trigger in-app bench harness via xcrun simctl openurl , see bench/README.md"
echo "[bench] device label: ${DEVICE_LABEL}"
echo "[bench] expected output: ${OUT_PATH}"

# Pull results from the simulator's app data container. simctl
# `get_app_container data` resolves the sandbox path; the harness is
# expected to write `Documents/bench-result.json`.
APP_BUNDLE_ID="${AIRGAP_BUNDLE_ID:-com.airgap.app}"
DATA_DIR="$(xcrun simctl get_app_container booted "${APP_BUNDLE_ID}" data 2>/dev/null || true)"
if [[ -z "${DATA_DIR}" ]]; then
  echo "[bench] could not resolve simulator data container for ${APP_BUNDLE_ID}" >&2
  echo "        Verify the bundle id matches your build (override with AIRGAP_BUNDLE_ID)." >&2
  exit 1
fi

SANDBOX_FILE="${DATA_DIR}/Documents/bench-result.json"
if [[ -f "${SANDBOX_FILE}" ]]; then
  cp "${SANDBOX_FILE}" "${OUT_PATH}"
  echo "[bench] pulled ${OUT_PATH}"
else
  echo "[bench] no result file at ${SANDBOX_FILE} yet , see bench/README.md" >&2
  echo "[bench] (this is expected until the in-app harness wiring lands)" >&2
  exit 1
fi
