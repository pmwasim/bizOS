# Assumptions

Status: Active register  
Last reviewed: 2026-07-26

Assumptions are explicit so they can be tested or replaced without pretending they are facts.

| ID    | Assumption                                                                                              | Consequence                                          | Validation / review trigger                              |
| ----- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------- |
| A-001 | The authenticated checkout at `/Users/pmwasim/Documents/Projects/bizOS` is the authoritative repository | Phase 0 work is committed there                      | Repository owner confirms or remote differs              |
| A-002 | Small-business teams value a unified product more than independently deployed services                  | Start with a modular monolith                        | Team ownership or measured scale creates isolation need  |
| A-003 | A tenant may operate multiple businesses with different staff access                                    | Tenant and business are separate mandatory scopes    | Customer discovery contradicts the model                 |
| A-004 | Auth.js can support the initial identity providers and session model                                    | Authentication stays in the web/BFF boundary         | Enterprise federation or native mobile needs exceed it   |
| A-005 | PostgreSQL can serve transactional scale through indexing, partitioning, replicas, and cells            | Avoid distributed writes                             | Load tests or operating metrics miss SLO                 |
| A-006 | R2's S3-compatible API meets object storage and regional requirements                                   | Use an adapter and direct signed transfer            | Residency, compliance, or feature gap                    |
| A-007 | BullMQ/Redis is suitable for retryable background work, not durable truth                               | PostgreSQL outbox remains authoritative              | Queue semantics or throughput prove insufficient         |
| A-008 | The source remains proprietary until the owner chooses a public license                                 | Repository is `UNLICENSED` despite public visibility | Written licensing decision                               |
| A-009 | Initial deployment provider and region are not yet selected                                             | Document target capabilities, defer provider IaC     | Budget, compliance, and team operations review           |
| A-010 | No jurisdiction-specific tax implementation is safe without specialist acceptance                       | Tax design only in Phase 0                           | Country rollout is funded and reviewed                   |
| A-011 | Node 22 and exact current framework releases are acceptable for the foundation                          | CI enforces the engine and lockfile                  | Support policy, advisory, or provider constraint changes |
| A-012 | English is the initial authoring language but Arabic/RTL is an early target                             | Tokens and layouts cannot assume LTR                 | Market sequencing changes                                |

An assumption becomes an ADR when it creates a durable architectural constraint.
