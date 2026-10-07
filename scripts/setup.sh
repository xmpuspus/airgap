#!/usr/bin/env bash
set -euo pipefail

# Guided brand setup for a checked-out copy of Airgap.
#
# The script copies one example template into the app, sets the brand fields
# in airgap.config.json, and rebuilds the knowledge manifest. It does not
# rename the native Android or iOS projects. Use `npx create-airgap-bot` to
# scaffold a renamed app.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."

TEMPLATES=(
  telco
  airline
  banking
  insurance
  healthcare
  electric-utility
  water-utility
  government-services
  custom
)

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
    echo "  A value is needed."
  done
}

pick_template() {
  echo ""
  echo "  Industry template:"
  for i in "${!TEMPLATES[@]}"; do
    printf "    %d) %s\n" "$((i + 1))" "${TEMPLATES[$i]}"
  done
  echo ""
  read -r -p "  Choose [1-${#TEMPLATES[@]}]: " choice
  if [[ "$choice" =~ ^[1-9][0-9]*$ ]] && ((choice >= 1 && choice <= ${#TEMPLATES[@]})); then
    echo "${TEMPLATES[$((choice - 1))]}"
  else
    echo "telco"
  fi
}

echo ""
echo "  Airgap brand setup"
echo "  Press Enter to accept a default."
echo ""

COMPANY_NAME="$(prompt_required "Company name (for example Metro Bank)")"
BOT_NAME="$(prompt_required "Bot name (for example MetroBot)")"
TEMPLATE="$(pick_template)"
PRIMARY_COLOR="$(prompt "Primary brand color (hex)" "#0047AB")"
HOTLINE="$(prompt "Hotline number" "1800")"
WEBSITE="$(prompt "Website domain (for example example.com)" "example.com")"

echo ""
echo "  Company  : $COMPANY_NAME"
echo "  Bot      : $BOT_NAME"
echo "  Template : $TEMPLATE"
echo "  Color    : $PRIMARY_COLOR"
echo "  Hotline  : $HOTLINE"
echo "  Website  : $WEBSITE"
echo ""
read -r -p "  Apply these values? [Y/n]: " confirm
[[ "${confirm:-y}" =~ ^[Yy]$ ]] || {
  echo "  Stopped. Nothing changed."
  exit 0
}

if [[ "$TEMPLATE" != "custom" ]]; then
  TEMPLATE_DIR="$ROOT/examples/$TEMPLATE"
  if [[ ! -d "$TEMPLATE_DIR" ]]; then
    echo "  [WARN] Template '$TEMPLATE' not found at $TEMPLATE_DIR. The current files stay."
  else
    echo "  Applying template: $TEMPLATE"
    cp "$TEMPLATE_DIR/airgap.config.json" "$ROOT/airgap.config.json"
    if [[ -d "$TEMPLATE_DIR/knowledge" ]]; then
      find "$ROOT/src/knowledge" -maxdepth 1 -type f -name '*.json' -delete
      cp "$TEMPLATE_DIR/knowledge/"*.json "$ROOT/src/knowledge/"
    fi
  fi
fi

echo "  Setting brand fields..."
CONFIG="$ROOT/airgap.config.json"
json_set "$CONFIG" '.brand.name' "$COMPANY_NAME"
json_set "$CONFIG" '.brand.botName' "$BOT_NAME"
json_set "$CONFIG" '.brand.hotline' "$HOTLINE"
json_set "$CONFIG" '.brand.website' "$WEBSITE"
json_set "$CONFIG" '.theme.primary' "$PRIMARY_COLOR"

echo "  Rebuilding the knowledge manifest..."
node "$ROOT/scripts/generate-manifest.js"

echo ""
echo "  Done. Changed files:"
echo "    airgap.config.json  (brand and theme)"
echo "    src/knowledge/      (template documents)"
echo "    src/knowledge/manifest.ts"
echo ""
echo "  Next steps:"
echo "    npm run kb:validate"
echo "    npm run android"
echo "    cd ios && pod install && cd .. && npm run ios"
echo ""
echo "  The app name and bundle identifiers did not change. Run npx create-airgap-bot"
echo "  for a renamed app, or edit the native projects by hand."
echo ""
