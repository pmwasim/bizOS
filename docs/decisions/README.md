# Architecture decision records

ADRs capture durable choices, alternatives, consequences, and review triggers. Accepted ADRs are
constraints until superseded.

| ADR                                                                 | Decision                                          | Status     |
| ------------------------------------------------------------------- | ------------------------------------------------- | ---------- |
| [0001](0001-record-architecture-decisions.md)                       | Record architecture decisions                     | Accepted   |
| [0002](0002-pnpm-turborepo-monorepo.md)                             | pnpm and Turborepo monorepo                       | Accepted   |
| [0003](0003-modular-monolith.md)                                    | Modular monolith before microservices             | Accepted   |
| [0004](0004-tenant-and-business-boundaries.md)                      | Separate tenant and business scopes               | Accepted   |
| [0005](0005-postgresql-and-prisma.md)                               | PostgreSQL and Prisma system of record            | Accepted   |
| [0006](0006-versioned-workflow-engine.md)                           | Versioned deterministic workflow engine           | Accepted   |
| [0007](0007-casbin-authorization.md)                                | Casbin domain-scoped authorization                | Accepted   |
| [0008](0008-money-representation.md)                                | Integer minor-unit money representation           | Accepted   |
| [0009](0009-authjs-session-boundary.md)                             | Auth.js browser session boundary                  | Accepted   |
| [0010](0010-outbox-bullmq-r2.md)                                    | Outbox, BullMQ/Redis, and R2 responsibilities     | Accepted   |
| [0011](0011-rest-openapi-contracts.md)                              | REST/OpenAPI public contracts                     | Accepted   |
| [0012](0012-governed-extensions-and-ai.md)                          | Governed plugins and AI agents                    | Accepted   |
| [0013](0013-quotation-document-slice.md)                            | Shared document facts, explicit quote service     | Accepted   |
| [0014](0014-single-maintainer-branch-protection.md)                 | Single-maintainer main protection policy          | Accepted   |
| [0015](0015-managed-hosting-behind-cloudflare.md)                   | Managed hosting behind Cloudflare for MVP         | Accepted   |
| [0016](0016-purchase-order-approval-readiness.md)                   | PO, approval evidence, derived readiness          | Accepted   |
| [0017](0017-po-object-storage.md)                                   | Local/R2 private object store for PO files        | Accepted   |
| [0018](0018-invoice-document-slice.md)                              | Invoice on shared document facts                  | Accepted   |
| [0019](0019-open-source-leverage-default-erp-foundation.md)         | Open-source leverage for Default ERP foundation   | Superseded |
| [0020](0020-configuration-aware-invoice-conversion.md)              | Configuration-aware invoice conversion            | Accepted   |
| [0021](0021-customer-payment-allocation-slice.md)                   | Customer payment allocation slice                 | Accepted   |
| [0021](0021-erpnext-foundation-customer-experience.md)              | ERPNext foundation with bizOS customer experience | Accepted   |
| [0022](0022-signed-client-ip-forwarding.md)                         | Signed client-IP forwarding for throttling        | Accepted   |
| [0022](0022-ubuntu-production-hosting.md)                           | Ubuntu production hosting                         | Accepted   |
| [0023](0023-invoice-settlement-is-derived.md)                       | Invoice settlement is derived, not stored         | Proposed   |
| [0024](0024-receivables-and-statements-are-derived-per-currency.md) | Receivables and statements derived per currency   | Proposed   |
| [0025](0025-payment-void-reversal-refund.md)                        | Payment voiding, reversal, and refunds            | Accepted   |

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
