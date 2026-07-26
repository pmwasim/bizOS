# ADR-0011: Use REST and OpenAPI for public contracts

Status: Accepted  
Date: 2026-07-26

## Context

Browsers, mobile, partners, plugins, and agents need stable discoverable APIs with predictable
authorization, retries, and tooling.

## Options considered

- GraphQL: flexible reads with added query-cost, caching, and authorization complexity.
- RPC only: strong generated clients but less universal external integration.
- Resource-oriented REST with OpenAPI: broad ecosystem, explicit HTTP semantics, and clear
  idempotency.

## Decision

Use versioned HTTP+JSON REST resources and commands documented with OpenAPI. Use RFC 9457 problems,
cursor pagination, idempotency keys, optimistic concurrency, and signed webhooks. Internal modules
do not communicate by public HTTP.

## Consequences

Some workflows need command subresources rather than pure CRUD. Over/under-fetching is managed with
bounded expansions and purpose-built read models.

## Validation and review trigger

Add another API style only for a proven consumer need and behind the same authentication,
authorization, observability, and compatibility policy.
