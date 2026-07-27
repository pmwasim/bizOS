# Architecture decision records

ADRs capture durable choices, alternatives, consequences, and review triggers. Accepted ADRs are
constraints until superseded.

| ADR                                                 | Decision                                      | Status   |
| --------------------------------------------------- | --------------------------------------------- | -------- |
| [0001](0001-record-architecture-decisions.md)       | Record architecture decisions                 | Accepted |
| [0002](0002-pnpm-turborepo-monorepo.md)             | pnpm and Turborepo monorepo                   | Accepted |
| [0003](0003-modular-monolith.md)                    | Modular monolith before microservices         | Accepted |
| [0004](0004-tenant-and-business-boundaries.md)      | Separate tenant and business scopes           | Accepted |
| [0005](0005-postgresql-and-prisma.md)               | PostgreSQL and Prisma system of record        | Accepted |
| [0006](0006-versioned-workflow-engine.md)           | Versioned deterministic workflow engine       | Accepted |
| [0007](0007-casbin-authorization.md)                | Casbin domain-scoped authorization            | Accepted |
| [0008](0008-money-representation.md)                | Integer minor-unit money representation       | Accepted |
| [0009](0009-authjs-session-boundary.md)             | Auth.js browser session boundary              | Accepted |
| [0010](0010-outbox-bullmq-r2.md)                    | Outbox, BullMQ/Redis, and R2 responsibilities | Accepted |
| [0011](0011-rest-openapi-contracts.md)              | REST/OpenAPI public contracts                 | Accepted |
| [0012](0012-governed-extensions-and-ai.md)          | Governed plugins and AI agents                | Accepted |
| [0013](0013-quotation-document-slice.md)            | Shared document facts, explicit quote service | Accepted |
| [0014](0014-single-maintainer-branch-protection.md) | Single-maintainer main protection policy      | Accepted |

## Template

New ADRs use this structure:

```text
# ADR-NNNN: Title
Status:
Date:
Deciders:

## Context
## Decision drivers
## Options considered
## Decision
## Consequences
## Validation and review trigger
```

Do not rewrite accepted decision history. Add clarification notes or supersede it with a new ADR.
