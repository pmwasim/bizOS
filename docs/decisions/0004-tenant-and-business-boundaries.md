# ADR-0004: Separate tenant and business boundaries

Status: Accepted  
Date: 2026-07-26

## Context

One customer account may operate multiple businesses with different identities, staff access,
currencies, numbering, tax registrations, and data visibility.

## Options considered

- Treat each business as a tenant: strong isolation but duplicates people, billing, and
  cross-business administration.
- One tenant with an optional business label: simpler schema but unsafe ambiguity.
- Tenant account plus mandatory business scope: supports shared administration and separation.

## Decision

Tenant is the security/commercial account. Business is an operating entity within a tenant. Every
business record and authorization decision carries both scopes. Cross-business capabilities are
explicit and separately authorized.

## Consequences

Queries and keys are more verbose. The model prevents accidental sharing and supports multi-
business users without identity duplication.

## Validation and review trigger

Revisit if legal residency or enterprise isolation requires a business to become a separate
database/account, using the planned cell migration path.
