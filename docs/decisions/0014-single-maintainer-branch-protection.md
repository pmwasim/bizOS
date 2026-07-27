# ADR-0014: Single-maintainer main-branch protection

Status: Accepted

Date: 2026-07-27

Deciders: Repository owner / release engineering

## Context

`main` previously required one approving code-owner review, stale-review dismissal, and approval of
the latest push. The only repository collaborator and CODEOWNER is `@pmwasim`, who authors the
release pull requests. GitHub does not allow meaningful self-approval, so required reviews created
an impossible merge gate for a single-maintainer repository.

## Decision drivers

- Keep CI, conversation resolution, linear history, and force-push/deletion prevention intact.
- Unblock private-beta release without fabricating reviewers or deceptive approvals.
- Restore multi-party approval when a trusted second maintainer exists.

## Options considered

- Keep required approvals and wait for a second maintainer — blocks private beta indefinitely.
- Disable branch protection entirely — unnecessarily weakens release safety.
- Narrowly remove the approval requirement while preserving all other protections — preferred.

## Decision

While only one maintainer exists:

- Pull requests into `main` remain required by process and tooling.
- Required status checks remain enforced and must pass before merge.
- Conversation resolution remains required.
- Force pushes and branch deletions remain blocked.
- Linear history and squash-only merges remain required.
- Separate approving reviews and code-owner approval are not required.

Restore `required_approving_review_count: 1`, `require_code_owner_reviews: true`, and
`require_last_push_approval: true` when a trusted second maintainer is added.

## Consequences

- The sole maintainer can squash-merge after green required checks and resolved conversations.
- CODEOWNERS remains informational ownership metadata.
- Security still depends on CI, secret scanning, CodeQL, dependency review, and conversation
  resolution rather than a second human reviewer during the single-maintainer period.

## Validation and review trigger

Revisit this ADR when a second trusted maintainer receives write access, or when organization policy
requires mandatory dual control regardless of team size.
