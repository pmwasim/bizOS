# Architecture

Status: Accepted Phase 0 architecture

## Context

bizOS is a multi-tenant SaaS platform used by browsers, future mobile clients, integrations,
plugins, and AI agents. External tax, payment, identity, and storage providers are untrusted
boundaries even when contracted.

## Deployable units

```text
Browser / future mobile / API clients
                 |
        CDN, WAF, rate limits
            /          \
   Next.js web/BFF    NestJS API
            \          /
              PostgreSQL
           /      |       \
         R2     Redis    Outbox
                          |
                    BullMQ workers
                          |
                 governed integrations
```

Phase 0 keeps one web deployable and one API/worker codebase. The API is a modular monolith: strong
module boundaries with a single transactional database. Measured load, ownership, or failure
isolation may later justify extracting a module behind its existing contracts.

## Workspace

- `apps/web`: Next.js application, Auth.js browser session boundary, and BFF concerns.
- `apps/api`: NestJS HTTP and worker composition root.
- `packages/contracts`: runtime schemas shared without framework coupling.
- `packages/ui`: accessible design tokens and shadcn/ui-compatible source components.
- `packages/config`: validated environment boundaries.
- `packages/database`: Prisma schema, generated client, migrations, and seed tooling.
- `packages/authorization`: Casbin model and policy adapter.
- `packages/queue`: BullMQ envelope and queue defaults.
- `packages/storage`: R2 client and safe object-key rules.

The responsive web application is the first client. Future Android, iPhone, desktop, and Linux
clients use versioned public application contracts and shared design tokens, not Next.js internals
or direct ERP database access.

## Module boundaries

Each domain module owns commands, queries, events, persistence mapping, and policies. Dependencies
point toward domain code. Cross-module writes occur through application commands. Cross-module read
models are explicit and rebuildable.

Initial future modules are identity, tenancy, parties, catalogue, documents, workflow, approvals,
payments, statements, notifications, files, integrations, and audit. Names express bounded contexts;
they are not authorization shortcuts.

## Consistency

Commands that change business truth use a PostgreSQL transaction. Domain events enter an outbox in
that transaction. Dispatch is at-least-once; consumers are idempotent. Redis loss may delay work but
cannot lose committed truth.

## Scalability

- Stateless web/API/worker processes scale horizontally.
- Tenant-aware indexes, bounded queries, cursor pagination, and asynchronous exports protect the
  primary database.
- Large file bytes go directly between client and R2 through short-lived signed operations.
- Search, analytics, and AI indexes are derived stores with deletion and rebuild paths.
- Hot tenants can move to dedicated partitions or database cells without changing public IDs or
  contracts.

## Plugin and AI readiness

Extensions use versioned manifests, declared scopes, signed packages, bounded webhooks/commands, and
isolated runtime resources. AI uses the same public application tools as integrations, receives
permission-filtered retrieval, cites source objects, and requires confirmation for material writes.
Neither receives raw database access.

## Quality attributes

Priority order: security and correctness, usability, recoverability, maintainability, observability,
performance, and extraction flexibility. Architecture claims require tests or operational evidence
before they are considered achieved.
