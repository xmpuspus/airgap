#!/usr/bin/env bash
# Download the shipped target GGUF (Gemma 4 E2B Q3_K_S) for local LLM journey tests.
#
# The device app downloads this on first launch via ModelManager. This script
# mirrors that behavior on a laptop so `__tests__/run-llm-journeys.mjs` can run
# against the real model without shelling into a phone.
#
# Usage: bash scripts/pull-dev-model.sh
#
# After download, run:
#   node __tests__/run-llm-journeys.mjs
#
# The SHA256 below is the x-linked-etag published by HuggingFace for the file
# referenced in airgap.config.json -> model.url. If HuggingFace republishes the
# file, update both this script and airgap.config.json in lockstep.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODEL_DIR="${REPO_ROOT}/models"
MODEL_NAME="gemma-4-e2b-it-q3ks.gguf"
MODEL_PATH="${MODEL_DIR}/${MODEL_NAME}"
MODEL_URL="https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/main/gemma-4-E2B-it-Q3_K_S.gguf"
EXPECTED_SHA256="2d010e251ba1fc44b746eb4059825a1954df5f90a1b7a360cf18232a520709aa"
EXPECTED_SIZE_BYTES=2445645184

mkdir -p "${MODEL_DIR}"

if [[ -f "${MODEL_PATH}" ]]; then
  echo "Model already present at ${MODEL_PATH}"
else
  echo "Fetching ${MODEL_URL}"
  echo "Target: ${MODEL_PATH} (~2.4 GB)"
  if command -v curl >/dev/null 2>&1; then
    curl -L --fail --progress-bar -o "${MODEL_PATH}.part" "${MODEL_URL}"
  elif command -v wget >/dev/null 2>&1; then
    wget --show-progress -O "${MODEL_PATH}.part" "${MODEL_URL}"
  else
    echo "error: neither curl nor wget is available" >&2
    exit 1
  fi
  mv "${MODEL_PATH}.part" "${MODEL_PATH}"
fi

actual_size=$(stat -f%z "${MODEL_PATH}" 2>/dev/null || stat -c%s "${MODEL_PATH}")
if [[ "${actual_size}" != "${EXPECTED_SIZE_BYTES}" ]]; then
  echo "warn: size mismatch (got ${actual_size}, expected ${EXPECTED_SIZE_BYTES})" >&2
fi

if command -v shasum >/dev/null 2>&1; then
  actual_sha=$(shasum -a 256 "${MODEL_PATH}" | awk '{print $1}')
elif command -v sha256sum >/dev/null 2>&1; then
  actual_sha=$(sha256sum "${MODEL_PATH}" | awk '{print $1}')
else
  echo "warn: no sha256 tool available, skipping verification" >&2
  actual_sha=""
fi

if [[ -n "${actual_sha}" && "${actual_sha}" != "${EXPECTED_SHA256}" ]]; then
  echo "error: SHA256 mismatch" >&2
  echo "  expected: ${EXPECTED_SHA256}" >&2
  echo "  actual:   ${actual_sha}" >&2
  exit 2
fi

echo "ok: ${MODEL_PATH}"
echo "ok: sha256 verified"
echo ""
echo "next: node __tests__/run-llm-journeys.mjs"
