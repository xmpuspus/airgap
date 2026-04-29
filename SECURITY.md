# Security policy

## Supported versions

| Version | Supported |
|---|---|
| `main` | Yes |
| Tagged releases from the last 6 months | Yes, security fixes only |
| Older tagged releases | No |

Airgap is pre-1.0. Expect breaking changes between minor versions, and
security fixes on `main` only.

## Reporting a vulnerability

Do NOT open a public issue for a security problem. Instead, email the
maintainer at the address listed in `CODEOWNERS`.

Include:

- Affected version (commit SHA or release tag)
- Steps to reproduce
- Impact assessment
- A suggested fix if you have one

You can expect an acknowledgment within 72 hours. Coordinated disclosure
is the default — we will work with you on a disclosure timeline that
gives operators time to update.

## Threat model (summary)

Airgap stores knowledge, runs an on-device LLM, and optionally syncs
content + telemetry with a backend. The threat model reflects these
three surfaces.

### On-device storage

Airgap uses MMKV with per-store encryption keys. Keys are derived via
`src/services/secretStore.ts`. Production deployments must install a
real provider (Keystore on Android, Keychain on iOS) via
`installSecretStoreProvider()` at boot. The fallback path uses an
install-derived key that is better than a hardcoded constant but weaker
than OS-backed secure storage.

What is encrypted:
- Conversation history
- Offline queue
- KB sync state (last version, last sync time, errors)
- Telemetry buffer
- Model manager state

What is NOT encrypted:
- The GGUF model file itself (public content)
- The bundled KB files (public content, but signed by the BFF)
- The `airgap-bootstrap` MMKV store used only for the install UUID

### Sync pipeline

Every KB bundle downloaded from the BFF is:

1. SHA256-verified against the manifest
2. ed25519-signature-checked against a pinned public key (when a native
   verifier is linked — see docs/sync-architecture.md for the build
   hook)

The device refuses bundles with mismatched hashes or invalid signatures,
atomically rolls back to the previous bundle, and flags the error in
MMKV. Production operators MUST pin `backend.syncPublicKey` and install
a native ed25519 verifier before production use.

### LLM pipeline

The safety layer at `src/services/safetyLayer.ts` gates every LLM
response. It rejects unsourced currency amounts and dates, runs a
pre-flight blocklist check, and surfaces refusal templates per vertical.
See `docs/safety-layer.md` for the full mitigations and known gaps.

### Telemetry

Events sent to the BFF use FNV-1a hashes for query and answer text, not
the raw content. Retrieved doc IDs are public KB identifiers. Tool
names are logged but tool arguments are not. See
`docs/observability.md` for the event schema.

### Known unmitigated threats

- **Rooted or jailbroken devices** — a user with root access can read
  MMKV stores regardless of encryption. Compliance-sensitive deployments
  should pair Airgap with a root detection library and disable sensitive
  tools on compromised devices.
- **A compromised BFF** — the device trusts the BFF's manifest metadata
  and signed bundles. An attacker with the BFF private key can push
  arbitrary KB content. Mitigations are operational: rotate keys, audit
  BFF infrastructure, pin TLS to a private CA if applicable.
- **Model weights on first download** — before the device has the
  shipped GGUF, it downloads from the configured `model.url`. The
  integrity check (sha256 + sizeBytes) protects against tampered
  downloads only if the operator pins a trusted URL and hash in config.

## Dependency security

Airgap pins exact versions in `package.json` (no `^`, no `~`). CI runs
`npm audit` on every commit. Critical/high CVEs block the merge.

## Responsible use

Airgap ships with safety layers and refusal templates for medical,
financial, and legal questions. Operators deploying for those verticals
are responsible for:

- Keeping refusal templates accurate for their jurisdiction
- Running their own adversarial test fixtures under
  `__tests__/golden/`
- Monitoring telemetry for refusal spikes
- Rotating BFF signing keys on a schedule

If your deployment discovers a systemic failure mode (the safety layer
misses a class of unsafe outputs, the tool router picks the wrong
backend method, etc.), please report it as a security issue.
