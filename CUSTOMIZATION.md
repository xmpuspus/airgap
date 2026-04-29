# Customization Guide

Everything is driven by `airgap.config.json`. No code changes needed for most customizations.

## Config Reference

### brand (required)

| Field | Required | Description |
|-------|----------|-------------|
| name | Yes | Company name (e.g., "Metro Bank") |
| botName | Yes | Bot display name (e.g., "MetroBot") |
| hotline | Yes | Support phone number for fallback |
| tagline | No | Short description for onboarding |
| hotlineLabel | No | Note about hotline (e.g., "free from mobile") |
| website | No | Company website domain |
| logo | No | Path to logo image asset |

### theme

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| primary | Yes | — | Main brand color (hex) |
| secondary | Yes | — | Accent color (hex) |
| background | Yes | — | Screen background |
| surface | No | #FFFFFF | Card/elevated surface |
| text | No | #1A1A2E | Primary text |
| textSecondary | No | #6B7280 | Secondary/muted text |
| textInverse | No | #FFFFFF | Text on colored backgrounds |
| botBubble | No | #E8EEF6 | Bot message background |
| botBubbleText | No | #1A1A2E | Bot message text |
| userBubble | No | = primary | User message background |
| userBubbleText | No | #FFFFFF | User message text |
| success | No | #10B981 | Success state |
| warning | No | #F59E0B | Warning state |
| error | No | #EF4444 | Error/destructive |
| font | No | System | Custom font family name |
| darkMode | No | false | `false`, `true`, or `"auto"` |
| darkTheme | No | auto-generated | Custom dark palette overrides |

**Dark Mode:**
- `false` — light theme only
- `true` — dark theme only
- `"auto"` — follows device system preference

If `darkTheme` is omitted, a dark palette is auto-generated from the light theme colors.

**Custom Fonts:**
Set `font` to your custom font family name. The font files must be linked in the native project (see React Native font linking docs).

### model

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| provider | Yes | — | `llama.cpp`, `execu-torch`, `core-ml`, `onnx`, `cloud` |
| url | Yes | — | Download URL for model file |
| filename | Yes | — | Local filename for downloaded model |
| sha256 | No | — | Checksum for integrity (empty = skip) |
| sizeMB | No | 500 | Expected size in MB (shown during download) |
| contextSize | No | 4096 | Context window size |
| maxTokens | No | 256 | Max generation tokens |
| temperature | No | 0.3 | LLM temperature (0-2) |
| topP | No | 0.9 | Top-p sampling (0-1) |
| stopTokens | No | model-specific | Stop sequences |
| gpuLayers | No | 99 | GPU offload layers (0 = CPU only) |
| threads | No | 4 | CPU threads (1-16) |

### knowledge

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| directory | Yes | — | Path to KB JSON files |
| schema | No | kbdoc-v1 | Document schema version |
| search.topK | No | 3 | Number of search results |
| search.fuzzy | No | 0.2 | Typo tolerance (0-1) |
| search.boostTitle | No | 3 | Title match weight |
| search.boostKeywords | No | 2 | Keyword match weight |
| search.boostContent | No | 1 | Content match weight |

### prompts

Template variables: `{{botName}}`, `{{brandName}}`, `{{hotline}}`, `{{hotlineLabel}}`, `{{currency}}`, `{{featureList}}`, `{{modelSize}}`

| Field | Required | Description |
|-------|----------|-------------|
| system | Yes | LLM system prompt. Keep short for small models. |
| welcome | Yes | First message shown to user |
| fallback | Yes | Shown when no results and no LLM |
| queued | No | Shown when action is queued offline |
| noModel | No | Appended to results when LLM not downloaded |

**System Prompt Tips:**
- Keep under 200 tokens for small models
- Include industry-specific guardrails ("Never provide financial advice")
- Reference the knowledge base grounding: "Answer ONLY using the CONTEXT"
- Specify currency and formatting preferences

### features

All boolean, all optional. Defaults shown.

| Field | Default | Description |
|-------|---------|-------------|
| offlineQueue | true | Queue online actions when offline |
| streamingTokens | true | Show LLM tokens as they generate |
| userFeedback | true | Thumbs up/down on bot messages |
| conversationPersistence | true | Save chat across restarts |
| sessionTimeoutMinutes | 30 | Clear history after inactivity |
| modelDownloadOnboarding | true | Show model download on first launch |

### privacy

| Field | Default | Description |
|-------|---------|-------------|
| dataRetentionDays | 30 | Auto-delete conversations after N days |
| allowExport | true | Show "Export conversation" in settings |
| allowDeleteData | true | Show "Delete all my data" in settings |
| privacyPolicyUrl | — | Link to privacy policy |

### i18n

Override any UI string by key:

```json
"i18n": {
  "strings": {
    "send": "Enviar",
    "settings": "Configuracion",
    "clearChat": "Borrar conversacion",
    "deleteModel": "Eliminar modelo",
    "getHelp": "Obtener ayuda",
    "about": "Acerca de",
    "aiModel": "Modelo AI",
    "status": "Estado",
    "downloaded": "Descargado",
    "notDownloaded": "No descargado",
    "chat": "Chat",
    "privacy": "Privacidad",
    "exportChat": "Exportar conversacion",
    "deleteAllData": "Eliminar todos mis datos",
    "privacyPolicy": "Politica de privacidad",
    "appVersion": "Version de la app",
    "cancel": "Cancelar",
    "delete": "Eliminar",
    "clear": "Borrar"
  }
}
```

### analytics

| Field | Default | Description |
|-------|---------|-------------|
| enabled | false | Enable analytics event hooks |

When enabled, the app emits events via the logger service. Integrate your analytics SDK by subscribing to logger events.

### auth

| Field | Default | Description |
|-------|---------|-------------|
| enabled | false | Require auth before chat |
| type | pin | `pin`, `biometric`, or `both` |

### actions

Online-required actions triggered by keyword matching:

```json
{
  "id": "balance_check",
  "label": "Check account balance",
  "keywords": ["my balance", "my bill amount"],
  "requiresOnline": true,
  "category": "account",
  "mockResponse": "Your balance is {{currency}} 127.50"
}
```

### quickReplies

Quick reply buttons shown after welcome and fallback:

```json
[
  {"title": "Check plans", "value": "What plans do you have?"},
  {"title": "Find a store", "value": "Where is the nearest store?"}
]
```

## Knowledge Base Authoring

### Document Schema (kbdoc-v1)

```json
{
  "id": "faq-001",
  "category": "faq",
  "title": "How to check my balance",
  "content": "You can check your balance by dialing *123# or through the app...",
  "keywords": ["balance", "check balance", "remaining credits"],
  "tags": ["account", "self-service"],
  "metadata": {}
}
```

**Required fields:** id, category, title, content, keywords, tags

**Category** is now a free-form string — use whatever categories make sense for your industry.

**Keywords** are the highest-weighted search terms. Include synonyms and common phrasings.

**Metadata** is optional and category-specific (e.g., price, address, hours).

### Import from CSV

```bash
node scripts/kb-import.js data.csv
```

CSV format: `id,category,title,content,keywords,tags`
- Keywords and tags are semicolon-separated within the cell
- Content can contain newlines (wrap in quotes)

### Validate

```bash
npm run kb:validate
```

Checks: required fields, no duplicate IDs, non-empty content. Reports category distribution and total size.

## Industry Templates

Ready-to-use configs in `examples/`:

| Industry | Bot Name | KB Entries | Categories |
|----------|----------|------------|------------|
| Telco | Alice | 107 | plans, promos, troubleshooting, stores, roaming, payments, faq |
| Airline | SkyBot | 36 | faq, services, troubleshooting, routes, lounges |
| Banking | PrimaAssist | 42 | faq, products, atm-locations, security, troubleshooting, fees |
| Insurance | ShieldBot | 38 | faq, products, troubleshooting, agents |
| Healthcare | CareBot | 36 | faq, services, locations, insurance, troubleshooting |
| Electric Utility | PowerBot | 38 | faq, services, troubleshooting, locations, payments |
| Water Utility | AquaBot | 38 | faq, services, troubleshooting, payments |

To use a template:
```bash
cp examples/banking/airgap.config.json airgap.config.json
cp examples/banking/knowledge/* src/knowledge/
node scripts/generate-manifest.js
```

## Defining a New Tool

The tool router lets the orchestrator call deterministic backend actions
when a user query matches a configured keyword set. Tool calls bypass the
LLM grounding pipeline and feed structured results back as context, so
prices, balances, and ticket IDs are always exact.

Define tools under the top-level `tools` array in `airgap.config.json`:

```json
"tools": [
  {
    "name": "checkBalance",
    "description": "Check the user's prepaid load balance and active promo",
    "vertical": "telco",
    "keywords": ["my balance", "load balance", "current load"],
    "stateChanging": false,
    "offlineQueueEligible": false,
    "backendMethod": "checkBalance",
    "parameters": {
      "type": "object",
      "properties": {
        "msisdn": {"type": "string", "description": "Mobile number"}
      }
    }
  }
]
```

Field reference:

| Field                  | Required | Description |
|------------------------|----------|-------------|
| `name`                 | yes      | Unique tool identifier — by convention matches the backend method name |
| `description`          | yes      | Human-readable label shown in the dev panel and tool pill |
| `vertical`             | no       | Vertical tag — used by docs and the dev panel |
| `keywords`             | yes      | Whole-word, case-insensitive trigger phrases. First match wins |
| `stateChanging`        | no       | When `true` and offline, the tool is queued via the offline queue |
| `offlineQueueEligible` | no       | Defaults to `true` for state-changing tools. Set to `false` to fail closed offline |
| `backendMethod`        | no       | Backend connector method to invoke. Defaults to `name` |
| `refusalReason`        | no       | Refusal template to use when execution fails (e.g. `not_medical_advice`) |
| `parameters`           | no       | JSON schema documenting the arguments — passed to a future function-calling LLM unchanged |

### Wiring the backend

Each tool maps to a method on `BackendConnector`. The default
`RestBackendConnector` resolves `backendMethod` against
`backend.endpoints[backendMethod]`:

```json
"backend": {
  "type": "rest",
  "baseUrl": "https://api.example.com",
  "auth": {"type": "bearer", "token": "REPLACE_ME"},
  "endpoints": {
    "checkBalance": "/v1/customer/balance"
  }
}
```

For more complex flows, implement a custom connector under
`src/services/backendConnector.ts` and register it via
`registerBackendConnector()`.

### Testing the tool

1. Add the tool definition to `airgap.config.json`
2. `npm test` — `__tests__/tool-router.test.ts` will fail if any keyword
   doesn't resolve back to the tool
3. Add a golden case under `__tests__/golden/<vertical>.json` with
   `expectTool: "<your tool name>"` so future audits catch keyword drift
4. Enable the Diagnostics panel in Settings (7-tap on App Version) and
   send a query that should trigger the tool. The Tool pill above the
   answer bubble names the tool that fired.

## White-Label Checklist

Files that reference the brand:

| File | What to Change |
|------|---------------|
| `airgap.config.json` | All brand, theme, prompts, actions |
| `app.json` | name, displayName |
| `android/app/build.gradle` | applicationId |
| `android/settings.gradle` | rootProject.name |
| `android/app/src/main/res/values/strings.xml` | app_name |
| `android/app/src/main/res/mipmap-*/` | App icons (all densities) |
| `ios/Podfile` | target name |
| `ios/*/Info.plist` | CFBundleDisplayName, CFBundleIdentifier |
| `ios/*/Images.xcassets/AppIcon.appiconset/` | App icons |
| `assets/images/airgap-avatar.png` | Bot avatar |
| `assets/images/airgap-logo.png` | Brand logo |
| `src/knowledge/*.json` | Knowledge base content |

The `scripts/setup.sh` wizard handles most of these automatically.
