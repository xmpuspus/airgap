# create-airgap-bot

Scaffold a config-driven, on-device customer support bot from one of the seven Airgap industry templates.

`create-airgap-bot` is a thin wrapper that fetches the [Airgap](https://github.com/xmpuspus/airgap) template, drops in the industry config and knowledge base of your choice, renames the React Native target to the bot name you pass, and leaves you with a buildable app.

## Install

The package is intended to be run via `npx`; no global install is required.

```
npx create-airgap-bot <bot-name> --template <industry>
```

Run with no arguments for an interactive prompt.

## Usage

```
npx create-airgap-bot acme-support --template telco
cd acme-support
npm install
npm run android   # or npm run ios
```

The scaffolder:

1. Downloads the Airgap source tarball from the `main` branch.
2. Copies the tree into `<bot-name>/`.
3. Replaces `airgap.config.json` and `src/knowledge/` with the chosen template.
4. Renames the React Native target across `package.json`, `app.json`, the Android Gradle module, the iOS workspace and `xcodeproj`, and the `Info.plist` display name.
5. Writes a `.airgap-scaffold.json` marker recording the bot name, generated PascalCase target, and Android package id.

## Supported templates

| Template | Slug | Audience |
|----------|------|----------|
| Airline | `airline` | Reservations, baggage, status |
| Banking | `banking` | Retail accounts, cards, transfers |
| Electric utility | `electric-utility` | Outages, billing, meters |
| Healthcare | `healthcare` | Patient triage, appointments |
| Insurance | `insurance` | Claims, policies, coverage |
| Telco | `telco` | Plans, roaming, troubleshooting |
| Water utility | `water-utility` | Outages, billing, conservation |

The full schema lives at [`airgap.schema.json`](https://github.com/xmpuspus/airgap/blob/main/airgap.schema.json) in the main repo. After scaffolding, every customization is a single-file edit on `airgap.config.json`.

## Options

| Flag | Description |
|------|-------------|
| `--template <industry>`, `-t` | Pick an industry template up front. Otherwise the CLI prompts. |
| `--help`, `-h` | Print usage. |
| `--version`, `-v` | Print package version. |

A positional argument is treated as the bot name. The CLI prompts if it is missing or invalid.

## Naming

The bot name must be kebab-case (lowercase letters, digits, hyphens; must start with a letter; 2 to 50 characters). The scaffolder derives:

- `package.json` `name`: the bot name as-is, e.g. `acme-support`.
- React Native component name and iOS target: PascalCase, e.g. `AcmeSupport`.
- Android `applicationId` and `namespace`: `com.<slug>`, where `<slug>` is the lowercase bot name with hyphens removed (e.g. `com.acmesupport`).

## Known limitations

- Native signing keys are not regenerated. The scaffolder ships the upstream debug keystore. Generate your own release keystore (`keytool -genkeypair`) and update `android/app/build.gradle` before publishing to a store.
- iOS provisioning profiles, App Store Connect bundle ids, and team ids are unchanged. Open the new workspace in Xcode and assign your team and a bundle id you own before archiving.
- Push notification entitlements, deep link schemes, and in-app purchase configurations are not migrated. Add them as needed.
- The download requires network access. For air-gapped scaffolding, vendor the tarball locally and pass `sourceDir` via the programmatic API in `scaffold.ts`.
- Knowledge base imports beyond the chosen template are out of scope. Use `npm run kb:import` from the scaffolded project.

## Programmatic use

```ts
import {scaffold} from 'create-airgap-bot/dist/scaffold';

await scaffold({
  botName: 'acme-support',
  template: 'telco',
  targetDir: '/abs/path/acme-support',
});
```

## Development

```
npm install
npx tsc --noEmit
npm test
```

The conflict-check helper verifies the package name on npm and a GitHub repo namespace before publish.

```
npm run conflict-check
```

## License

MIT. See [LICENSE](LICENSE).
