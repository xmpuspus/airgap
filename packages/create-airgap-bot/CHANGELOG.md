# Changelog

## 0.1.0

Initial release.

- CLI accepts a kebab-case bot name and `--template <industry>`; prompts interactively when either is missing.
- Seven industry templates: airline, banking, electric-utility, healthcare, insurance, telco, water-utility.
- Fetches the Airgap source tarball from `xmpuspus/airgap@main`, applies the chosen template config and knowledge base, and renames the React Native target across package.json, app.json, Android Gradle, iOS workspace, xcodeproj, and Info.plist.
- Programmatic `scaffold()` entrypoint for tests and offline workflows.
- `conflict-check` helper verifies npm name and GitHub repo availability before publish.
- Engines: Node >= 22.11.
