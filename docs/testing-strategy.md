# Testing strategy

Status: Accepted

## Test pyramid

- **Unit**: pure domain rules, formulas, tax vectors, value objects, and UI logic.
- **Component**: accessible UI behavior and application use cases with controlled adapters.
- **Integration**: real PostgreSQL, Redis, R2-compatible test environment, Auth.js, Casbin, queue
  workers, and migrations.
- **Contract**: OpenAPI compatibility, webhook examples, plugin manifests, and job envelopes.
- **End-to-end**: critical browser workflows against deployed product paths.
- **Operational**: backup restore, rollback, queue recovery, key rotation, and failover exercises.

## Mandatory invariants

- Cross-tenant and cross-business access is denied at API and database boundaries.
- Issued facts are immutable and correction paths retain history.
- Money and tax vectors cover scale, rounding, negative values, partial allocation, and currency
  mismatch.
- Commands are idempotent under retry and reject stale versions.
- Jobs tolerate duplicate delivery and resume after worker failure.
- Authorization covers people, service principals, agents, revoked access, and policy changes.

## Test quality

Tests assert outcomes and durable effects, not private implementation detail. Time, randomness, and
external boundaries are controllable, but tests that claim infrastructure behavior use the real
service. No retry may conceal a failed gate. Flaky tests are failures with an owner and containment
plan.

## CI layers

Pull requests run formatting, lint, types, unit/contract tests, Prisma validation, migration
deployment against PostgreSQL, authenticated Redis integration, production builds, desktop and
mobile end-to-end quotation journeys through Mailpit, OCI image builds, dependency review, GitHub
secret scanning, and CodeQL. Deployment verification remains a post-merge gate owned by the
deployment environment.

## Coverage

Coverage is a diagnostic, not the target. Changed critical domain and security code requires branch
coverage. A lower global threshold may be introduced only with a ratchet that cannot decrease.
Mutation testing is preferred for formula, tax, permissions, and workflow guards.
