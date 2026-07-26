# Product requirements

Status: Accepted foundation requirements; domain feature detail remains gated

## Goals

- Establish a secure, operable platform on which document workflows can be delivered safely.
- Give non-accountants a clear, low-training workflow from offer to payment.
- Support multiple tenants, businesses, languages, currencies, and tax regimes.
- Create stable extension points for public APIs, integrations, plugins, automation, and AI.

## Non-goals for Phase 0

- Implementing quotations, orders, invoices, payments, statements, CRM, or a general ledger.
- Selecting country-specific tax rules without legal and product validation.
- Splitting the system into microservices.
- Exposing an ungoverned plugin runtime or AI tool execution.

## Foundation requirements

| ID      | Requirement                                                                                      | Priority | Acceptance evidence                    |
| ------- | ------------------------------------------------------------------------------------------------ | -------- | -------------------------------------- |
| FND-001 | One reproducible monorepo command validates the platform                                         | Must     | `pnpm check` passes in CI              |
| FND-002 | Web, API, shared UI, contracts, data, queue, storage, and authorization have explicit boundaries | Must     | Workspace graph and architecture tests |
| FND-003 | Environment input is validated at process boundaries                                             | Must     | Schema tests and fail-fast startup     |
| FND-004 | Tenant and business scope are mandatory authorization inputs                                     | Must     | Cross-tenant denial tests              |
| FND-005 | Database changes are migration-only and backward compatible                                      | Must     | Migration CI on empty and prior schema |
| FND-006 | Security, deployment, rollback, observability, and incident duties are documented                | Must     | Handbook review                        |
| FND-007 | Dependencies and GitHub Actions are reproducible and continuously reviewed                       | Must     | Lockfile, pinned actions, Dependabot   |
| FND-008 | Architectural decisions and assumptions are recorded                                             | Must     | Accepted ADR index and assumption log  |

## Product capabilities after foundation acceptance

| ID      | Capability        | Essential behavior                                                              |
| ------- | ----------------- | ------------------------------------------------------------------------------- |
| DOC-001 | Offers            | Draft, send, accept, decline, revise, and convert without losing history        |
| DOC-002 | Purchase orders   | Request and confirm supplier commitments with approvals                         |
| DOC-003 | Invoice approvals | Capture source, review differences, decide, and preserve evidence               |
| DOC-004 | Invoices          | Finalize immutable business facts and issue customer-safe outputs               |
| DOC-005 | Payments          | Record allocation, partial payment, overpayment, refund, and reversal           |
| DOC-006 | Statements        | Explain opening, activity, payments, and balance for a time range               |
| WF-001  | Workflow          | Configurable guarded transitions, assignments, due dates, and escalation        |
| TAX-001 | Tax               | Effective-dated, jurisdiction-aware, explainable calculation                    |
| CUR-001 | Currency          | Currency-safe math, document currency, base-currency reporting, rate provenance |
| LOC-001 | Language          | Locale-aware UI and documents with bidirectional layout support                 |
| EXT-001 | API               | Versioned, idempotent, scoped, auditable public API and webhooks                |
| AI-001  | AI assistance     | Permission-scoped suggestions with citations and explicit confirmation          |

## Cross-cutting release gates

- No cross-tenant access in application or database integration tests.
- No destructive workflow transition without confirmation and durable audit evidence.
- No money represented by binary floating-point.
- No tax or formula result without inputs, version, and explanation.
- No uploaded active content served from the application origin by default.
- No state-changing cookie-authenticated endpoint without CSRF controls.
- No public API mutation without idempotency behavior.
- No AI agent receiving broader authority than the initiating user.

## Success criteria for the first application

- At least 80% of first-time users complete the primary happy path without external help.
- Median time to find the next required action is under 10 seconds.
- Correctable validation explains the issue and recovery action in plain language.
- Every issued document can be reproduced from versioned facts.
- Every material transition identifies actor, time, reason, source, and correlation ID.
