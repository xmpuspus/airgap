# Roadmap

Airgap focuses on a dependable offline-first support path for Android and iOS.
The roadmap favors checked runtime state, small public contracts, and operator
control over identity and business actions.

## Current release candidate

- Secure application storage starts before user-data services.
- Demo, local, cloud, and offline answer states are visible.
- Knowledge retrieval and answer sources use one conversation path.
- Downloaded knowledge needs length, hash, key, signature, and schema checks.
- Network actions use an encrypted outbox with receipts and manual recovery.
- The CLI copies a version-matched template that ships in its own package.
- Seven industry templates have validation, journey coverage, and fresh recorded
  flows tied to the checked commit.
- Android, iOS, site, security, dependency, and documentation gates produce a
  local release evidence report.

## Next

- Add a documented identity-provider example without coupling the core app to one
  vendor.
- Add a durable rate-limit adapter and request audit hooks to the reference
  server.
- Publish model compatibility results from named physical devices, with exact
  model hashes and thermal conditions.
- Add screen-reader test automation for the main onboarding, answer, outbox, and
  deletion paths.
- Add a migration contract for future config and knowledge schema versions.
- Add a supported key-rotation window for signed knowledge bundles.

## Later, if evidence supports it

- A second native inference adapter that preserves the current routing contract.
- More languages with domain-reviewed retrieval and refusal fixtures.
- A background sync policy tested across Android and iOS lifecycle limits.
- Pluggable durable queue storage for larger operator workloads.

## Not planned as core features

- A hosted control plane or hosted customer data service.
- Embedded production credentials or a generic password login screen.
- Automatic approval of sensitive account actions on the device.
- Claims of HIPAA, GDPR, FedRAMP, financial, medical, or legal compliance.
- Browser and desktop ports that weaken the mobile offline boundary.
- A general-purpose agent framework or an inference benchmark product.

Open a [feature request](https://github.com/xmpuspus/airgap/issues/new?template=feature_request.md)
with the user problem, operating mode, security effect, and test approach. The
maintainer can change priorities when field evidence shows a more important gap.
