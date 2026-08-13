# Customize an Airgap app

Most product changes start in `airgap.config.json` and the active knowledge directory. Native
application names, signing identities, icons, and platform permissions still need Android or
iOS project changes. The exact machine-readable contract is in
[`airgap.schema.json`](airgap.schema.json).

## Start from a checked template

The package command copies a complete application and applies one of the seven included fixtures.

```bash
npx create-airgap-bot field-help --template water-utility
cd field-help
npm install
npm run android
```

To work from this repository instead, copy a fixture and rebuild the knowledge manifest.

```bash
cp examples/banking/airgap.config.json airgap.config.json
cp examples/banking/knowledge/*.json src/knowledge/
node scripts/generate-manifest.js
npm run kb:validate
```

All example brands, prices, locations, policies, and account responses are fictional. Replace and
review them before any pilot.

## Brand and interface

The `brand` object controls the displayed company name, assistant name, support number, website,
tagline, and logo path. The `theme` object controls light and optional dark palettes.

Set these values.

- `brand.name`, `brand.botName`, and `brand.hotline`
- `theme.primary`, `theme.secondary`, and `theme.background`

Colors use six-digit hex values such as `#0E7490`. Link a custom `theme.font` in both
native projects. `theme.darkMode` accepts `false`, `true`, or `"auto"`.

The `onboarding` object controls the title, subtitle, ability list, and downloaded-model copy.
The `quickReplies` array sets the suggested questions shown in chat.

## Answer providers

Two configuration sections have different jobs.

- `model` describes the optional GGUF file used by the downloaded `llama.rn` provider. The current
  downloaded-model engine is `llama.cpp`.
- `llm` controls operating mode, provider order, platform rules, and cloud endpoint settings.

Airgap recognizes five provider IDs.

| ID                        | Purpose                                      |
| ------------------------- | -------------------------------------------- |
| `apple-foundation-models` | Apple on-device model on an eligible device  |
| `android-aicore`          | Android ML Kit Prompt API on a listed device |
| `llama-rn`                | App-downloaded GGUF model                    |
| `cloud`                   | Operator service with fresh authentication   |
| `demo`                    | Deterministic local document formatter       |

This configuration keeps the app offline and uses document answers if the system model is not
available.

```json
{
  "llm": {
    "mode": "offline-only",
    "supportDomain": "banking",
    "providers": [
      {
        "id": "apple-foundation-models",
        "enabled": true,
        "priority": 0,
        "platform": "ios",
        "minimumOsVersion": "26.0",
        "locales": ["en", "en-US"],
        "allowModelDownload": false,
        "allowCloudFallback": false
      },
      {
        "id": "llama-rn",
        "enabled": true,
        "priority": 10,
        "platform": "all",
        "allowModelDownload": true,
        "allowCloudFallback": false
      },
      {
        "id": "demo",
        "enabled": true,
        "priority": 30,
        "platform": "all"
      }
    ]
  }
}
```

Lower priority numbers run first. `demo` mode uses only `demo`. `offline-only` always removes
cloud. `prefer-offline` and `prefer-online` follow the listed order after policy filtering.

For each provider, check `enabled`, `platform`, domain lists, locale lists, OS floor, download
permission, and cloud permission. The app refreshes provider status before each request.

See [`DEPLOYMENT.md`](DEPLOYMENT.md) for native provider requirements, rollout, and rollback.

## Downloaded model

The `model` object needs a URL, filename, exact byte count, and SHA-256 digest for a production
download. The app checks the byte count and digest before loading the file.

```json
{
  "model": {
    "provider": "llama.cpp",
    "url": "https://models.example.com/support-model.gguf",
    "filename": "support-model.gguf",
    "sha256": "64-lowercase-hex-characters",
    "sizeBytes": 123456789,
    "contextSize": 4096,
    "maxTokens": 256,
    "temperature": 0.3,
    "topP": 0.9
  }
}
```

Do not publish an empty digest or a moving model URL. Measure memory, latency, heat, and answer
quality on every supported device class.

## Knowledge documents

Every `kbdoc-v1` record needs `id`, `category`, `title`, `content`, `keywords`, and `tags`.

```json
{
  "id": "faq-001",
  "category": "faq",
  "title": "Replace a lost card",
  "content": "Call the support number immediately. A verified agent can block the card.",
  "keywords": ["lost card", "stolen card", "block card"],
  "tags": ["cards", "security"],
  "metadata": {}
}
```

Use plain customer language in titles and keywords. Put dates, prices, eligibility rules, and
emergency instructions in the content because the answer checker compares answer amounts and
dates with retrieved documents.

Import and check content with these commands.

```bash
npm run kb:import -- path/to/knowledge.csv
npm run kb:validate
npm run kb:studio
```

The CSV columns are `id,category,title,content,keywords,tags`. Keywords and tags use semicolons
inside one cell. See [`docs/kb-studio.md`](docs/kb-studio.md).

## Prompts and safety

`prompts.system` tells a model how to phrase retrieved facts. It must not grant authority to choose
tools, approve account changes, or invent missing company information. `prompts.welcome`,
`prompts.fallback`, `prompts.queued`, and `prompts.noModel` control customer-facing fallback copy.

The `safety` section has a literal topic blocklist, per-reason refusal copy, and checks for
unsourced amounts and dates. These checks are narrow. They do not show factual accuracy or legal
compliance. Add domain review and adversarial fixtures for every intended audience.

See [`docs/safety-layer.md`](docs/safety-layer.md) for exact behavior and limits.

## Actions, tools, and the backend

The `actions` array defines customer intents that need a network and their fallback copy. The `tools` array
maps approved keywords to a known backend method. A model never emits the tool name.

```json
{
  "name": "createTicket",
  "description": "Create a support ticket",
  "keywords": ["create ticket", "open a case"],
  "stateChanging": true,
  "offlineQueueEligible": true,
  "backendMethod": "createTicket",
  "vertical": "telco"
}
```

When a state-changing tool is eligible and the device is offline, Airgap stores it in the
encrypted outbox. A production backend must authenticate the user, authorize the exact action,
honor the idempotency key, and return a stable result. The reference connector does not replace
those controls.

Set `backend.type` to `rest`, use an HTTPS `baseUrl`, set `auth.type` to `provider`, and pin at least
one knowledge-signing public key. Install the access-token provider in application startup code.
Never place a bearer token or client secret in JSON.

See [`docs/enterprise-integration.md`](docs/enterprise-integration.md),
[`docs/tool-calling.md`](docs/tool-calling.md), and
[`docs/sync-architecture.md`](docs/sync-architecture.md).

## Privacy, telemetry, and language

The `privacy` section controls retention, export, deletion, and the privacy-policy link. The
`analytics` switch enables event hooks, but a production telemetry sink still needs an explicit
integration and retention policy. Airgap does not send raw questions or answers by default.

The `locale` object controls language, region, currency, date format, and number format. The
`i18n.strings` map overrides named interface strings. A translated interface does not mean that
language reviewers approved the knowledge documents or model.

## Native identity and assets

The scaffolder renames the common React Native, Android, and iOS identifiers. Review these paths
before signing a store build.

| Path                                             | Purpose                         |
| ------------------------------------------------ | ------------------------------- |
| `app.json`                                       | React Native name               |
| `android/app/build.gradle`                       | Android application ID          |
| `android/app/src/main/res/values/strings.xml`    | Android display name            |
| `android/app/src/main/res/mipmap-*`              | Android icons                   |
| `ios/Airgap.xcodeproj/project.pbxproj`           | iOS product and bundle settings |
| `ios/Airgap/Info.plist`                          | iOS display and privacy values  |
| `ios/Airgap/Images.xcassets/AppIcon.appiconset/` | iOS icons                       |
| `assets/images/`                                 | In-app logo and assistant image |

Set your own signing team, bundle identifiers, privacy disclosures, and store metadata. Do not
reuse the sample identity for a customer build.

## Check a customization

```bash
npm run docs:check
npm run kb:validate
npm run journeys
npm run lint
npx tsc --noEmit
npm test -- --runInBand
```

Run both native debug builds after configuration fields, native files, dependencies, or platform
providers change. Record the changed journey when interface copy or example content changes.
