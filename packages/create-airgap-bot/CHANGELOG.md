# Changelog

## 0.2.0

- Includes the app source in the package, so scaffolding does not download a moving Git branch.
- Includes all seven industry fixtures and the current provider-based runtime.
- Copies Apple Foundation Models and Android ML Kit Prompt API bridge files into new apps.
- Excludes repository-only plans, evidence, tests, and local files from new projects.
- Tests both packaged and local-source installation paths before `npm pack`.

## 0.1.0

First release.

- CLI accepts a kebab-case bot name and `--template <industry>`. It prompts when either is missing.
- Includes seven templates for airline, banking, electric utility, healthcare, insurance, telecom,
  and water utility.
- Downloads the Airgap source from `xmpuspus/airgap@main`, applies the chosen template config and
  knowledge base, and renames the React Native target. Version 0.2.0 replaced this moving download
  with a package-owned template.
- Programmatic `scaffold()` entrypoint for tests and offline workflows.
- `conflict-check` helper checks npm name and GitHub repo availability before publish.
- Needs Node 22.11 or newer.
