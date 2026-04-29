#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."

# ── helpers ──────────────────────────────────────────────────────────────────

print_banner() {
  echo ""
  echo "  ╔═══════════════════════════════════════╗"
  echo "  ║          Airgap Setup Wizard           ║"
  echo "  ║   Enterprise configuration tool       ║"
  echo "  ╚═══════════════════════════════════════╝"
  echo ""
}

# Lowercase, spaces→underscores, strip non-alphanumeric except underscores
sanitize_pkg() {
  echo "$1" | tr '[:upper:]' '[:lower:]' | tr ' ' '_' | tr -cd 'a-z0-9_'
}

sed_inplace() {
  local expr="$1" file="$2"
  if sed --version >/dev/null 2>&1; then
    sed -i "$expr" "$file"
  else
    sed -i '' "$expr" "$file"
  fi
}

json_set() {
  local file="$1" key="$2" value="$3"
  node - "$file" "$key" "$value" <<'NODE'
const fs = require('fs');
const [file, key, value] = process.argv.slice(2);
const config = JSON.parse(fs.readFileSync(file, 'utf8'));
const path = key.replace(/^\./, '').split('.');
let cursor = config;
for (const segment of path.slice(0, -1)) {
  cursor[segment] = cursor[segment] ?? {};
  cursor = cursor[segment];
}
cursor[path[path.length - 1]] = value;
fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
NODE
}

# ── prompts ──────────────────────────────────────────────────────────────────

prompt() {
  local label="$1" default="${2:-}" var
  if [[ -n "$default" ]]; then
    read -r -p "  $label [$default]: " var
    echo "${var:-$default}"
  else
    read -r -p "  $label: " var
    echo "$var"
  fi
}

prompt_required() {
  local label="$1" var
  while true; do
    read -r -p "  $label: " var
    if [[ -n "${var// }" ]]; then
      echo "$var"
      return
    fi
    echo "  Please enter a value."
  done
}

pick_template() {
  local templates=(telco airline banking insurance healthcare electric-utility water-utility custom)
  echo ""
  echo "  Industry template:"
  for i in "${!templates[@]}"; do
    printf "    %d) %s\n" "$((i+1))" "${templates[$i]}"
  done
  echo ""
  read -r -p "  Choose [1-${#templates[@]}]: " choice
  if [[ "$choice" =~ ^[1-9][0-9]*$ ]] && (( choice >= 1 && choice <= ${#templates[@]} )); then
    echo "${templates[$((choice-1))]}"
  else
    echo "telco"
  fi
}

# ── main ─────────────────────────────────────────────────────────────────────

print_banner

echo "  Configure your branded offline support deployment."
echo "  Press Enter to accept defaults."
echo ""

COMPANY_NAME="$(prompt_required "Company name (e.g. Metro Bank)")"
BOT_NAME="$(prompt_required "Bot name (e.g. MetroBot)")"
TEMPLATE="$(pick_template)"
PRIMARY_COLOR="$(prompt "Primary brand color (hex)" "#0047AB")"
HOTLINE="$(prompt "Hotline number" "1800")"
WEBSITE="$(prompt "Website domain (e.g. example.com)" "example.com")"

SANITIZED_PKG="$(sanitize_pkg "$COMPANY_NAME")"
if [[ -z "$SANITIZED_PKG" ]]; then
  echo "  Could not derive a valid package name from company name."
  exit 1
fi
if [[ ! "$SANITIZED_PKG" =~ ^[a-z_] ]]; then
  SANITIZED_PKG="app_${SANITIZED_PKG}"
fi

echo ""
echo "  ─────────────────────────────────────────"
echo "  Company   : $COMPANY_NAME"
echo "  Bot       : $BOT_NAME"
echo "  Template  : $TEMPLATE"
echo "  Color     : $PRIMARY_COLOR"
echo "  Hotline   : $HOTLINE"
echo "  Website   : $WEBSITE"
echo "  App ID    : com.$SANITIZED_PKG"
echo "  ─────────────────────────────────────────"
echo ""
read -r -p "  Proceed? [Y/n]: " confirm
[[ "${confirm:-y}" =~ ^[Yy]$ ]] || { echo "  Aborted."; exit 0; }

# ── 1. Copy template ──────────────────────────────────────────────────────────

if [[ "$TEMPLATE" != "custom" ]]; then
  TEMPLATE_DIR="$ROOT/examples/$TEMPLATE"
  if [[ ! -d "$TEMPLATE_DIR" ]]; then
    echo "  [WARN] Template '$TEMPLATE' not found at $TEMPLATE_DIR. Skipping template copy."
  else
    echo "  Applying template: $TEMPLATE"
    cp "$TEMPLATE_DIR/airgap.config.json" "$ROOT/airgap.config.json"
    if [[ -d "$TEMPLATE_DIR/knowledge" ]]; then
      find "$ROOT/src/knowledge" -maxdepth 1 -type f -name '*.json' -delete
      cp "$TEMPLATE_DIR/knowledge/"*.json "$ROOT/src/knowledge/" 2>/dev/null || true
    fi
  fi
fi

# ── 2. Apply brand overrides ──────────────────────────────────────────────────

echo "  Applying brand overrides..."

CONFIG="$ROOT/airgap.config.json"

json_set "$CONFIG" '.brand.name'    "$COMPANY_NAME"
json_set "$CONFIG" '.brand.botName' "$BOT_NAME"
json_set "$CONFIG" '.brand.hotline' "$HOTLINE"
json_set "$CONFIG" '.brand.website' "$WEBSITE"
json_set "$CONFIG" '.theme.primary' "$PRIMARY_COLOR"

# ── 3. Regenerate KB manifest ─────────────────────────────────────────────────

echo "  Regenerating knowledge base manifest..."
node "$ROOT/scripts/generate-manifest.js"

# ── 4. Update app.json ────────────────────────────────────────────────────────

echo "  Updating app.json..."
APP_JSON="$ROOT/app.json"
json_set "$APP_JSON" '.name'        "$COMPANY_NAME"
json_set "$APP_JSON" '.displayName' "$COMPANY_NAME"

# ── 5. Android ───────────────────────────────────────────────────────────────

echo "  Updating Android files..."

BUILD_GRADLE="$ROOT/android/app/build.gradle"
sed_inplace "s|applicationId \"com\.[^\"]*\"|applicationId \"com.${SANITIZED_PKG}\"|g" "$BUILD_GRADLE"
sed_inplace "s|namespace \"com\.[^\"]*\"|namespace \"com.${SANITIZED_PKG}\"|g" "$BUILD_GRADLE"

SETTINGS_GRADLE="$ROOT/android/settings.gradle"
sed_inplace "s|rootProject\.name = '[^']*'|rootProject.name = '${COMPANY_NAME}'|g" "$SETTINGS_GRADLE"

STRINGS_XML="$ROOT/android/app/src/main/res/values/strings.xml"
sed_inplace "s|<string name=\"app_name\">[^<]*</string>|<string name=\"app_name\">${COMPANY_NAME}</string>|g" "$STRINGS_XML"

# ── 6. iOS ────────────────────────────────────────────────────────────────────

echo "  Updating iOS Podfile..."
PODFILE="$ROOT/ios/Podfile"
# Replace the target name (e.g. target 'ACME Telecom' do → target 'Metro Bank' do)
sed_inplace "s|target '[^']*' do|target '${COMPANY_NAME}' do|g" "$PODFILE"

# ── 7. Summary ────────────────────────────────────────────────────────────────

echo ""
echo "  ╔═══════════════════════════════════════╗"
echo "  ║            Setup complete!            ║"
echo "  ╚═══════════════════════════════════════╝"
echo ""
echo "  Changes applied:"
echo "    [DONE] airgap.config.json — brand + theme"
echo "    [DONE] app.json — name / displayName"
echo "    [DONE] android/app/build.gradle — applicationId com.$SANITIZED_PKG"
echo "    [DONE] android/settings.gradle — rootProject.name"
echo "    [DONE] android/app/src/main/res/values/strings.xml — app_name"
echo "    [DONE] ios/Podfile — target name"
echo "    [DONE] src/knowledge/manifest.ts — regenerated"
echo ""
echo "  Next steps:"
echo "    1. npm install"
echo "    2. Android build:  npm run android"
echo "    3. iOS build:      cd ios && pod install && cd .. && npm run ios"
echo ""
echo "  Your app ID: com.$SANITIZED_PKG"
echo ""
