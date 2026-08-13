# Security policy

## Report a vulnerability privately

Use [GitHub private vulnerability reporting](https://github.com/xmpuspus/airgap/security/advisories/new).
Do not open a public issue with exploit details, credentials, private data, or an
unfixed vulnerability.

Include the affected commit or version, platform, configuration mode, steps to
reproduce, expected impact, and any tested mitigation. Remove tokens, customer
records, and proprietary knowledge documents from the report.

The maintainer aims to acknowledge a complete report within three business days
and give a first assessment within ten business days. Complex native or
upstream dependency problems can take longer. The maintainer and reporter will
agree on a disclosure date after a fix or practical mitigation exists.

## Supported versions

Airgap is pre-1.0. The project supports the default branch and the latest tagged
minor release. Older minor releases can receive a fix when the maintainer judges
the backport to be safe, but the project does not promise that support.

| Version                      | Security support |
| ---------------------------- | ---------------- |
| `main`                       | Yes              |
| Latest tagged minor release  | Yes              |
| Older minor releases         | Best effort      |
| Unmodified third-party forks | No               |

## Security design

### Local storage

Airgap creates a random 32-byte key for each user-data MMKV store. Android
Keystore or iOS Keychain protects that key. The app opens secure storage before
conversation, queue, sync, model, telemetry, or preference services can read
data. Startup fails closed when the platform key store is unavailable.

iOS device builds use the application identifier prefix in `Airgap.entitlements`.
Simulator builds use the locally supplied team identifier prefix in
`AirgapSimulator.entitlements`. Keep both files private to the app target. Adding
another app to the access group would allow that app to request the same stored key.

The public GGUF model file and bundled knowledge JSON are not encrypted. The app
checks a downloaded model against its expected byte length and SHA-256 before
use. Operators must decide whether their knowledge content can live in the app
bundle or file system.

### Network access

App configuration does not accept a stored bearer token or OAuth client secret.
An operator installs an asynchronous token provider. The REST, sync, model
manifest, and cloud generation paths request a fresh token when they run.

The reference server checks its bearer value with a timing-safe digest compare,
limits request bodies to 256 KB, and applies a fixed-window per-client rate
limit. Its rate state lives in one Node process. Put a production deployment
behind TLS, shared rate limiting, monitoring, and an authorization layer that
understands each account action.

### Knowledge updates

The server signs the exact bundle bytes with Ed25519. The mobile app checks the
declared length, SHA-256, pinned key ID, signature, and document schema before an
atomic swap. A failed check keeps the last valid bundle. Protect and rotate the
private signing key outside this repository.

### Telemetry

Telemetry is off in the default configuration. When an operator enables it, the
client sends event fields described in [`docs/observability.md`](docs/observability.md).
Query and answer values use short non-cryptographic hashes for grouping. These
hashes are not anonymization and can be vulnerable to guessing. Review the event
schema and retention policy before enabling telemetry.

## Risks that need operator controls

- Root or jailbreak access can bypass application storage protections.
- A stolen bundle-signing key can authorize malicious knowledge content.
- A malicious model can produce unsafe or misleading text even when its file
  hash matches configuration.
- The safety layer and local retrieval do not set up medical, financial,
  legal, or regulatory compliance.
- A compromised backend can misuse valid action requests unless it enforces
  user authorization and idempotency.
- Mobile backups, logs, screenshots, keyboards, and accessibility services can
  expose data outside Airgap's stores.

## Dependency handling

CI fails when a high or critical advisory applies directly to code in a direct
dependency. CI reports high advisories inherited through React Native and
Metro dependency chains. Dependabot, dependency review, CodeQL, and OpenSSF
Scorecard add separate signals. See the current CI output before making a release
decision.

## Public security discussions

Use a public issue for hardening ideas only when they do not show a working
exploit or sensitive data. After coordinated disclosure, the project records the
affected versions, fix, and credit in a GitHub security advisory and changelog.
