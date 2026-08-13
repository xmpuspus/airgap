# create-airgap-bot

Create a React Native customer support app from one of Airgap's seven industry templates. The package includes the app source, native projects, configuration schema, and knowledge files. Scaffolding does not fetch source code from GitHub.

## Run the CLI with npx

You do not need a global install.

```sh
npx create-airgap-bot <bot-name> --template <industry>
```

Run the command without arguments to use the interactive prompts.

```sh
npx create-airgap-bot acme-support --template telco
cd acme-support
npm install
npm run android
```

Use `npm run ios` for iOS.

The CLI does five operations.

1. Copies the app source included in the npm package.
2. Applies the industry configuration and knowledge files that you chose.
3. Renames the React Native, Android, and iOS targets.
4. Rebuilds the TypeScript knowledge manifest.
5. Writes `.airgap-scaffold.json` with the derived app names.

## Seven templates are included

| Template         | Slug               | Main use                             |
| ---------------- | ------------------ | ------------------------------------ |
| Airline          | `airline`          | Reservations, baggage, flight status |
| Banking          | `banking`          | Retail accounts, cards, transfers    |
| Electric utility | `electric-utility` | Outages, billing, meters             |
| Healthcare       | `healthcare`       | Patient triage, appointments         |
| Insurance        | `insurance`        | Claims, policies, coverage           |
| Telco            | `telco`            | Plans, roaming, troubleshooting      |
| Water utility    | `water-utility`    | Outages, billing, conservation       |

The configuration contract is in
[`airgap.schema.json`](https://github.com/xmpuspus/airgap/blob/main/airgap.schema.json). Edit
`airgap.config.json` in the new project to change its brand, downloaded model, provider policy,
remote services, quick replies, and operating mode. See the
[`CUSTOMIZATION.md`](https://github.com/xmpuspus/airgap/blob/main/CUSTOMIZATION.md) guide before
changing provider or backend fields.

## CLI options control the first project

| Flag                          | Result                                        |
| ----------------------------- | --------------------------------------------- |
| `--template <industry>`, `-t` | Select an industry template before prompting. |
| `--help`, `-h`                | Print command help.                           |
| `--version`, `-v`             | Print the package version.                    |

Pass the bot name as the first argument. Names use kebab case, start with a letter, and contain 2 to 50 lowercase letters, digits, or hyphens.

For `acme-support`, the CLI sets these values.

| Target                           | Value             |
| -------------------------------- | ----------------- |
| npm package name                 | `acme-support`    |
| React Native and iOS target name | `AcmeSupport`     |
| Android application ID           | `com.acmesupport` |

## Store releases need your signing identity

- Android includes its normal debug keystore for local development. Supply `AIRGAP_RELEASE_STORE_FILE`, `AIRGAP_RELEASE_KEY_ALIAS`, `AIRGAP_RELEASE_STORE_PASSWORD`, and `AIRGAP_RELEASE_KEY_PASSWORD` when you make a signed release.
- In Xcode, assign your Apple team and an App Store bundle identifier before you archive the app.
- Keep the bundled private Keychain access and its device and simulator entitlement files when changing the Xcode target.
- Add any project-specific push notification, deep link, or payment entitlements.
- The CLI applies one bundled knowledge set. Import more documents with `npm run kb:import` in the new project.

## Code can call the scaffolder directly

```ts
import {scaffold} from 'create-airgap-bot/dist/scaffold';

await scaffold({
  botName: 'acme-support',
  template: 'telco',
  targetDir: '/absolute/path/acme-support',
});
```

Tests and internal tools can pass `sourceDir` to copy a local Airgap checkout instead of the packaged template.

## Package checks run from the Airgap repository

```sh
npm ci
npm run cli:pack:test
```

The pack check builds the template, scaffolds projects from both package and local sources, and inspects the npm archive. Run `npm run conflict-check` before publication to check the package and repository names on their public services.

## License

MIT. See [LICENSE](LICENSE).
