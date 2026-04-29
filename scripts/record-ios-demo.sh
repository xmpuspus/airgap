#!/bin/bash
# iOS full-feature demo autopilot script
# Records from real iOS Simulator via simctl + AppleScript input
#
# Simulator window: position + size from System Events
# Usage: ./scripts/record-ios-demo.sh [device-name]

set -euo pipefail

DEVICE="${1:-iPhone 17 Pro}"
BUNDLE_ID="org.reactjs.native.example.Airgap"
LOCAL_MP4="/tmp/airgap-ios-demo.mp4"
LOCAL_GIF="/tmp/airgap-ios-demo.gif"
FINAL_GIF="demo/airgap-demo-ios.gif"

# ── Get Simulator window geometry ────────────────────────
echo "=== ACME Telecom iOS Full-Feature Demo ==="
echo "Device: $DEVICE"

# Activate Simulator
osascript -e 'tell application "Simulator" to activate'
sleep 1

# Get window position and size
GEOM=$(osascript -e '
tell application "System Events"
    tell process "Simulator"
        set winPos to position of front window
        set winSize to size of front window
        return (item 1 of winPos) & "," & (item 2 of winPos) & "," & (item 1 of winSize) & "," & (item 2 of winSize)
    end tell
end tell
')
WIN_X=$(echo "$GEOM" | cut -d, -f1 | tr -d ' ')
WIN_Y=$(echo "$GEOM" | cut -d, -f2 | tr -d ' ')
WIN_W=$(echo "$GEOM" | cut -d, -f3 | tr -d ' ')
WIN_H=$(echo "$GEOM" | cut -d, -f4 | tr -d ' ')
echo "  Window: ${WIN_X},${WIN_Y} ${WIN_W}x${WIN_H}"

# Simulator has chrome at top (~28px for title bar)
# The phone screen content maps to the window content area
CHROME_TOP=28

# Compute screen area within window
SCREEN_X=$WIN_X
SCREEN_Y=$((WIN_Y + CHROME_TOP))
SCREEN_W=$WIN_W
SCREEN_H=$((WIN_H - CHROME_TOP))

echo "  Screen area: ${SCREEN_X},${SCREEN_Y} ${SCREEN_W}x${SCREEN_H}"

# iOS screenshot resolution (Retina 3x for iPhone 17 Pro)
# Actual: 1206x2622 mapped to window area
SCALE_X=$(python3 -c "print(${SCREEN_W} / 1206.0)")
SCALE_Y=$(python3 -c "print(${SCREEN_H} / 2622.0)")
echo "  Scale: ${SCALE_X} x ${SCALE_Y}"

tap() {
  # Convert iOS point coordinates to screen coordinates
  local ios_x=$1
  local ios_y=$2
  local screen_x=$(python3 -c "print(int(${SCREEN_X} + ${ios_x} * ${SCALE_X}))")
  local screen_y=$(python3 -c "print(int(${SCREEN_Y} + ${ios_y} * ${SCALE_Y}))")
  osascript -e "
    tell application \"System Events\"
      click at {${screen_x}, ${screen_y}}
    end tell
  "
}

type_text() {
  local text="$1"
  # Use pbcopy + paste for reliable text input
  echo -n "$text" | xcrun simctl pbcopy "$DEVICE"
  sleep 0.3
  # Cmd+V to paste
  osascript -e '
    tell application "System Events"
      keystroke "v" using command down
    end tell
  '
}

press_enter() {
  osascript -e '
    tell application "System Events"
      key code 36
    end tell
  '
}

wait_sec() {
  echo "  [wait ${1}s]"
  sleep "$1"
}

screenshot() {
  local name="${1:-screen}"
  xcrun simctl io "$DEVICE" screenshot "/tmp/${name}.png" 2>/dev/null
  echo "  [screenshot: /tmp/${name}.png]"
}

send_message() {
  local text="$1"
  echo "  Sending: \"$text\""
  # Tap input field (bottom center of screen)
  tap 603 2450
  wait_sec 1
  type_text "$text"
  wait_sec 1
  press_enter
}

# ── Preflight ──────────────────────────────────────────────

# Kill and reset app state
echo "[1] Resetting app state..."
xcrun simctl terminate "$DEVICE" "$BUNDLE_ID" 2>/dev/null || true
# Remove app data but keep the app installed
APP_DATA=$(xcrun simctl get_app_container "$DEVICE" "$BUNDLE_ID" data 2>/dev/null || echo "")
if [ -n "$APP_DATA" ]; then
  rm -rf "$APP_DATA/Documents/mmkv" 2>/dev/null || true
  rm -rf "$APP_DATA/Library/Preferences" 2>/dev/null || true
fi
sleep 1

# Start recording
echo "[2] Starting screen recording..."
xcrun simctl io "$DEVICE" recordVideo --codec h264 --force "$LOCAL_MP4" &
REC_PID=$!
sleep 1

# Launch app
echo "[3] Launching app..."
xcrun simctl launch "$DEVICE" "$BUNDLE_ID"
sleep 5

echo "[4] === DEMO FLOW START ==="
echo ""

# ── Scene 1: Onboarding (6s) ────────────────────────────
echo "--- Scene 1: Onboarding ---"
wait_sec 3

screenshot "ios-s01-onboarding"

# Scroll down to reveal Start Chatting
echo "  Scrolling to Start Chatting"
osascript -e '
  tell application "System Events"
    tell process "Simulator"
      set frontmost to true
    end tell
  end tell
'
# Swipe up on the simulator
tap 603 2200
wait_sec 2

# Tap Start Chatting button
echo "  Tapping Start Chatting"
tap 603 2200
wait_sec 4

screenshot "ios-s02-chat-empty"

# ── Scene 2: Chat empty state (3s) ──────────────────────
echo ""
echo "--- Scene 2: Chat empty state ---"
wait_sec 3

# ── Scene 3: Plans query (25s) ──────────────────────────
echo ""
echo "--- Scene 3: Plans query ---"
# Tap "Check plans" quick reply chip (bottom row)
tap 200 2370
echo "  Tapped: Check plans"
wait_sec 22
screenshot "ios-s03-plans"

# ── Scene 4: Troubleshooting (25s) ──────────────────────
echo ""
echo "--- Scene 4: Troubleshooting ---"
send_message "My internet is very slow"
wait_sec 22
screenshot "ios-s04-troubleshoot"

# ── Scene 5: Store locator (25s) ────────────────────────
echo ""
echo "--- Scene 5: Store locator ---"
send_message "Where is the nearest store"
wait_sec 22
screenshot "ios-s05-store"

# ── Scene 6: Balance check (25s) ────────────────────────
echo ""
echo "--- Scene 6: Balance check ---"
send_message "Check my balance"
wait_sec 22
screenshot "ios-s06-balance"

# ── Scene 7: Create ticket (25s) ────────────────────────
echo ""
echo "--- Scene 7: Create ticket ---"
send_message "Create a support ticket"
wait_sec 22
screenshot "ios-s07-ticket"

# ── Scene 8: Safety refusal (8s) ────────────────────────
echo ""
echo "--- Scene 8: Safety refusal ---"
send_message "How do I invest my money in stocks"
wait_sec 8
screenshot "ios-s08-safety"

# ── Scene 9: Settings (8s) ──────────────────────────────
echo ""
echo "--- Scene 9: Settings ---"
# Tap settings gear (top right)
tap 1140 150
wait_sec 3
screenshot "ios-s09-settings"

# Go back
tap 80 150
wait_sec 2

# ── Final: scroll through conversation ──────────────────
echo ""
echo "--- Final: scroll through conversation ---"
wait_sec 3

# ── Stop recording ──────────────────────────────────────
echo ""
echo "[5] Stopping recording..."
kill $REC_PID 2>/dev/null || true
sleep 3

# ── Convert to GIF ──────────────────────────────────────
echo "[6] Converting to optimized GIF..."
ffmpeg -y -i "$LOCAL_MP4" \
  -vf "fps=10,scale=360:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3" \
  "$LOCAL_GIF" 2>/dev/null

GIF_SIZE=$(stat -f%z "$LOCAL_GIF" 2>/dev/null || stat -c%s "$LOCAL_GIF" 2>/dev/null)
echo "  Raw GIF: $((GIF_SIZE / 1024))KB"

if [ "$GIF_SIZE" -gt 15728640 ]; then
  echo "  Over 15MB, reducing to 8fps 320px..."
  ffmpeg -y -i "$LOCAL_MP4" \
    -vf "fps=8,scale=320:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=96:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=4" \
    "$LOCAL_GIF" 2>/dev/null
  GIF_SIZE=$(stat -f%z "$LOCAL_GIF" 2>/dev/null || stat -c%s "$LOCAL_GIF" 2>/dev/null)
fi

cp "$LOCAL_GIF" "$FINAL_GIF"
echo ""
echo "=== DONE ==="
echo "  MP4: $LOCAL_MP4"
echo "  GIF: $FINAL_GIF ($((GIF_SIZE / 1024))KB)"
echo "  Review screenshots: ls /tmp/ios-s*.png"
