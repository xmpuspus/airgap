#!/usr/bin/env bash
set -euo pipefail

# Pure-Node demo-mode benchmark runner. No emulator/simulator required.
# Resolves the project root from this script's location and invokes
# bench/lib/run-node.mjs, which writes a timestamped JSON to
# bench/results/. Exits 0 on success, 1 on any failure.
#
# Environment variables passed through:
#   AIRGAP_BENCH_DEVICE  Label for the "device" field in output JSON.
#                        Defaults to "node-host" inside the runner.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
RUNNER="${SCRIPT_DIR}/lib/run-node.mjs"

if [[ ! -f "${RUNNER}" ]]; then
  echo "[bench] runner missing: ${RUNNER}" >&2
  exit 1
fi

cd "${PROJECT_ROOT}"
exec node "${RUNNER}"
