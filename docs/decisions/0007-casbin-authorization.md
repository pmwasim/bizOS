# ADR-0007: Use Casbin for authorization policy

Status: Accepted  
Date: 2026-07-26

## Context

Roles vary by business, workflows require action-level permissions, and future agents/plugins need
least-privilege policies.

## Options considered

- Hard-coded roles: simple but inflexible and scattered.
- Database permission checks only: custom and difficult to reason about consistently.
- Zanzibar-style external service: powerful relationship model with significant operating cost.
- Casbin embedded policy engine: expressive domain-scoped model with a small initial footprint.

## Decision

Use Casbin with subject, tenant, business, object, and action inputs. Store policy durably,
invalidate caches safely, and combine policy with domain guards and scoped repositories.

## Consequences

Policy naming and cache correctness require governance. Casbin decisions are not proof that an
object is in scope; database queries still enforce scope.

## Validation and review trigger

Re-evaluate if relationship depth, policy distribution, decision latency, or global consistency
requires a dedicated authorization service.
