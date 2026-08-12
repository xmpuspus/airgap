# Governance

Airgap uses a maintainer-led model. Xavier Puspus (`@xmpuspus`) is the current
maintainer and final decision maker for repository scope, security response,
merges, releases, package publication, and project policy.

## How decisions happen

Small fixes can continue through a focused pull request. Changes to architecture,
security boundaries, configuration schema, supported platforms, dependencies,
governance, or user data handling need a public issue or design note before code.

The maintainer evaluates a proposal against these questions.

1. Does it improve the offline-first mobile support use case?
2. Can the repository test the behavior and document its exact limits?
3. Does it keep identity, authorization, signing keys, and production account
   systems under operator control?
4. Does it preserve a maintainable Android and iOS path?
5. Does its long-term cost fit the maintainer capacity?

The maintainer records a material decision in the issue, pull request, design
document, changelog, or roadmap. Lack of response does not mean approval.

## Contributions and review

Anyone can report a bug, propose a change, review a pull request, or send code.
The current maintainer assigns review and merge authority. `CODEOWNERS` lists
the paths that need maintainer review.

Repeated, correct contributions can lead to scoped review or triage authority.
The maintainer documents that authority in this file and `CODEOWNERS` before it
takes effect. No other maintainers exist at this time.

## Releases

Airgap has no date-based release cadence. A patch release follows a reviewed fix
when users need it. A minor release groups a coherent set of checked changes and
can include breaking changes before 1.0.

A release needs passing repository checks, Android and iOS build evidence, an
inspected diff, current docs and recordings, dependency and secret review, and a
changelog entry. The maintainer approves the tag, GitHub release, and any npm
publication as separate actions.

## Security and conduct

The maintainer handles vulnerability reports under [`SECURITY.md`](SECURITY.md)
and conduct reports under [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md). Report a
conflict of interest in private. If the only maintainer has a conflict,
the parties should use GitHub's reporting channels or agree on a neutral reviewer.

## Changes to governance

A governance change uses a pull request with its reason, transition steps, and
effect on existing authority. The current maintainer approves it. If the project
becomes inactive, a successor needs an explicit public handoff before claiming
maintainer authority.
