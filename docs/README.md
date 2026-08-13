# Find the right Airgap guide

Airgap separates product setup, runtime design, production integration, and release evidence so a
reader does not need to infer which document applies. Start with the path that matches your role.

## Operators set up the support product

1. Read [`../CUSTOMIZATION.md`](../CUSTOMIZATION.md) for branding, local documents, quick replies,
   providers, and actions.
2. Use [`../DEPLOYMENT.md`](../DEPLOYMENT.md) for native setup, signing, physical-device checks,
   rollout, and rollback.
3. Use [`enterprise-integration.md`](enterprise-integration.md) before connecting identity, support
   APIs, document sync, cloud generation, or telemetry.
4. Read [`../SECURITY.md`](../SECURITY.md) for the security boundary and private reporting route.

## App developers follow the answer path

- [`hybrid-llm-design.md`](hybrid-llm-design.md) explains provider readiness, choice, fallback,
  cancellation, and provenance.
- [`safety-layer.md`](safety-layer.md) explains checks before and after generation and states what
  those checks do not guarantee.
- [`tool-calling.md`](tool-calling.md) explains why models cannot authorize or run account
  changes.
- [`sync-architecture.md`](sync-architecture.md) explains signed knowledge bundles and atomic local
  updates.

## Knowledge authors work locally first

- [`kb-studio.md`](kb-studio.md) covers the browser-based local authoring tool and validation.
- [`../examples/README.md`](../examples/README.md) compares all seven fixture industries and links to
  each checked emulator recording.
- [`../CUSTOMIZATION.md`](../CUSTOMIZATION.md) gives the schema fields and content workflow.

## Backend developers keep account authority on the server

- [`enterprise-integration.md`](enterprise-integration.md) defines token, API, sync, cloud, and
  deployment contracts.
- [`tool-calling.md`](tool-calling.md) defines action requests, authorization checks, idempotency,
  queue receipts, and retry behavior.
- [`sync-architecture.md`](sync-architecture.md) defines signed bundle publication and client checks.
- [`observability.md`](observability.md) lists safe diagnostics and the fields that telemetry omits.

## Maintainers check evidence before publication

- [`provider-validation.md`](provider-validation.md) gives the simulator scenarios, Apple host
  probe, physical-device preflight, optional Android model placement, and report rules.
- [`recordings.md`](recordings.md) gives the Android, iOS, joint, and industry recording process.
- [`observability.md`](observability.md) lists diagnostic and telemetry fields and their privacy
  limits.
- [`../CONTRIBUTING.md`](../CONTRIBUTING.md) lists needed tests and review checks.
- [`../PRODUCT-AUDIT.md`](../PRODUCT-AUDIT.md) separates checked behavior from open product gates.
- [`../ROADMAP.md`](../ROADMAP.md) lists current release gates and deferred work.

Files under `docs/superpowers/` and `docs/plans/` are code history. They can explain a past
decision. The guides above, the public schema, tests, and source define current behavior.
