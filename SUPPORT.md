# Support

Airgap is a maintainer-led open-source project. Community support is best effort
and does not offer a service-level agreement.

## Where to ask

- Use the [bug report template](https://github.com/xmpuspus/airgap/issues/new?template=bug_report.md)
  for a reproducible defect in this repository.
- Use the [feature request template](https://github.com/xmpuspus/airgap/issues/new?template=feature_request.md)
  for a scoped change to the product or public configuration contract.
- Use [GitHub private vulnerability reporting](https://github.com/xmpuspus/airgap/security/advisories/new)
  for a security problem.

Search existing issues before opening a new one. Keep secrets, private customer
data, proprietary knowledge, and exploit details out of public issues.

## Include in a bug report

- Airgap version or commit SHA
- Android or iOS version, device or simulator name, and architecture
- Node, JDK, Xcode, CocoaPods, and Android SDK versions that affect the problem
- Active `llm.mode`, backend type, and template name
- Exact steps and the smallest safe configuration that reproduces the problem
- Expected and actual behavior
- Sanitized logs, screenshots, or a small repository when useful

## Project support boundary

The maintainer can investigate Airgap code, schemas, tests, starter templates,
and the reference server. The maintainer cannot operate or debug a private
identity provider, mobile fleet, cloud model, account system, signing service,
network, app-store account, or changed fork without a public reproduction.

Report React Native, `llama.rn`, Android toolchain, Xcode, model-format, and
third-party service defects to their upstream projects after confirming that a
minimal Airgap-specific case does not exist.

The project does not offer emergency support, security monitoring, compliance
certification, legal advice, or recovery of deleted data.

## Response and closure

The maintainer triages issues as time permits. An issue can close when it lacks a
safe reproduction, belongs upstream, falls outside the roadmap, duplicates
another issue, or has no recent response after the maintainer requests details.
Anyone can reopen the discussion with new evidence.
