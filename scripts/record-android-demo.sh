#!/bin/bash
# Android demo — tap-only, no typed input
# Onboarding → chat → 3 quick replies → settings → scroll
#
# Screen: 1080x2400 @ 420dpi (emulator)
# Usage: ./scripts/record-android-demo.sh [emulator-5554]

set -euo pipefail
export PATH="$PATH:$HOME/Library/Android/sdk/platform-tools:$HOME/Library/Android/sdk/emulator"

SERIAL="${1:-emulator-5554}"
ADB="adb -s $SERIAL"
REC="/data/local/tmp/demo.mp4"
MP4="/tmp/airgap-android-demo.mp4"
GIF="demo/airgap-demo.gif"

tap()   { $ADB shell input tap "$1" "$2"; }
swipe() { $ADB shell input swipe "$1" "$2" "$3" "$4" "${5:-300}"; }
wait_s() { echo "  [${1}s]"; sleep "$1"; }

echo "=== ACME Telecom Android Demo (tap-only) ==="
$ADB shell wm size

# ── Reset ────────────────────────────────────────────────
echo "[1] Reset..."
$ADB shell am force-stop com.airgap
sleep 2
$ADB shell "rm -rf /data/data/com.airgap/files/mmkv /data/data/com.airgap/shared_prefs /data/data/com.airgap/cache" 2>/dev/null
sleep 1
echo "  MMKV: $($ADB shell "ls /data/data/com.airgap/files/mmkv 2>/dev/null && echo EXISTS || echo gone")"

# ── Record ───────────────────────────────────────────────
$ADB shell "rm -f $REC" 2>/dev/null
echo "[2] Recording..."
$ADB shell "screenrecord --time-limit 180 --bit-rate 6000000 $REC" &
REC_PID=$!
sleep 1

# ── Launch ───────────────────────────────────────────────
echo "[3] Launch..."
$ADB shell am start -n com.airgap/.MainActivity
sleep 5

# ── Onboarding (5s) ─────────────────────────────────────
echo "[S1] Onboarding"
wait_s 2
# Scroll to reveal Start Chatting
swipe 540 1800 540 1200 400
wait_s 2
# Start Chatting
tap 540 2100
wait_s 4

# ── Empty state (3s) ────────────────────────────────────
echo "[S2] Empty state"
wait_s 3

# ── Quick reply: Check plans (22s) ──────────────────────
echo "[S3] Check plans"
# Bottom chip row: "Check plans" at ~(202, 2076)
tap 202 2076
wait_s 22

# ── Quick reply: Troubleshoot (22s) ─────────────────────
echo "[S4] Troubleshoot"
# "Troubleshoot an issue" at ~(602, 2076)
tap 602 2076
wait_s 22

# ── Quick reply: Find a store (22s) ─────────────────────
echo "[S5] Find a store"
# "Find a store" at ~(971, 2076)
tap 971 2076
wait_s 22

# ── Settings (6s) ───────────────────────────────────────
echo "[S6] Settings"
# Gear icon top-right
tap 996 202
wait_s 3
# Scroll down in settings (safe — not a FlatList)
swipe 540 1600 540 800 400
wait_s 3
# Back
$ADB shell input keyevent 4
wait_s 2

# ── Final: gentle scroll to show conversation ───────────
echo "[S7] Conversation scroll"
# Scroll DOWN (shows older messages, safe direction)
swipe 540 800 540 1400 800
wait_s 2
# Scroll back UP slowly
swipe 540 1400 540 900 800
wait_s 2

# ── Stop ─────────────────────────────────────────────────
echo "[4] Stop recording..."
kill $REC_PID 2>/dev/null || true
sleep 3

# ── Convert ──────────────────────────────────────────────
echo "[5] Pull..."
$ADB pull $REC "$MP4"

echo "[6] GIF..."
ffmpeg -y -i "$MP4" \
  -vf "fps=10,scale=360:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3" \
  "$GIF" 2>/dev/null

SIZE=$(stat -f%z "$GIF" 2>/dev/null || stat -c%s "$GIF" 2>/dev/null)
echo "  GIF: $((SIZE / 1024))KB"

if [ "$SIZE" -gt 15728640 ]; then
  echo "  >15MB, reducing..."
  ffmpeg -y -i "$MP4" \
    -vf "fps=8,scale=320:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=96:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=4" \
    "$GIF" 2>/dev/null
  SIZE=$(stat -f%z "$GIF" 2>/dev/null || stat -c%s "$GIF" 2>/dev/null)
fi

echo ""
echo "=== DONE: $GIF ($((SIZE / 1024))KB) ==="
