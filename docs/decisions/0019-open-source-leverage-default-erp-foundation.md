# ADR-0019: Open-source leverage for the Default ERP configuration foundation

Status: Accepted

Date: 2026-07-28

Deciders: Product and engineering

## Context

PR #30 merged and redefined bizOS as a "Default bizOS ERP with optional customization" product (PRD
v4.0). PRD §22 Stage B — the next delivery gate — requires:

- a versioned Default bizOS ERP template;
- optional onboarding choices and guided setup;
- configuration templates and versions;
- business assignment;
- specialized-workflow preservation;
- System Admin role and initial portal;
- workflow-specific readiness.

ADR-0006 already decided the workflow engine shape: "immutable versioned workflow definitions,
deterministic guarded transitions, human tasks, PostgreSQL truth, transactional outbox, BullMQ
scheduling. No arbitrary code." ADR-0007 decided Casbin for authorization. ADR-0010 decided
PostgreSQL truth, BullMQ/Redis queues, and R2 object bytes. ADR-0013/0018 established immutable JSON
snapshots and per-business numbering for commercial documents.

This ADR evaluates whether any new open-source dependency is required to build the Stage B
configuration/workflow versioning foundation, or whether the existing stack is sufficient.

## Stack verification

Confirmed by reading `package.json` files across the monorepo:

| Capability               | Package                                                              | Version         | Notes                                                           |
| ------------------------ | -------------------------------------------------------------------- | --------------- | --------------------------------------------------------------- |
| Web framework            | `next` (apps/web)                                                    | 16.2.12         |                                                                 |
| React                    | `react` / `react-dom` (apps/web)                                     | 19.2.8          |                                                                 |
| API framework            | `@nestjs/*` (apps/api)                                               | 11.1.28         |                                                                 |
| ORM                      | `@prisma/client` (packages/database)                                 | 7.9.0           |                                                                 |
| Database driver          | `@prisma/adapter-pg` + `pg`                                          | 7.9.0 / 8.22.0  | PostgreSQL via Render                                           |
| Authentication           | `next-auth` (apps/web)                                               | 5.0.0-beta.32   | Auth.js                                                         |
| Authorization            | `casbin` (packages/authorization)                                    | 5.51.1          | ADR-0007; installed, no Prisma adapter wired yet                |
| Validation               | `zod` (catalog)                                                      | 4.4.3           | Shared across api/web/contracts/config                          |
| UI primitives            | `class-variance-authority` + `clsx` + `tailwind-merge` (packages/ui) | —               | shadcn/ui-style primitives; no `shadcn` package dependency      |
| E2E                      | `@playwright/test`                                                   | 1.62.0          |                                                                 |
| Object storage           | `@aws-sdk/client-s3` (packages/storage)                              | 3.1095.0        | R2 via S3 interface                                             |
| Queue                    | `bullmq` + `ioredis` (packages/queue)                                | 5.81.2 / 5.11.1 | ADR-0010                                                        |
| Email                    | `nodemailer` (apps/api)                                              | 9.0.3           | SMTP boundary; **`resend` is NOT installed** despite task brief |
| Workflow / state machine | —                                                                    | —               | None installed; ADR-0006 mandates constrained in-house engine   |
| n8n                      | —                                                                    | —               | Self-hosted on Ubuntu, not in code (expected)                   |

Gaps versus the task brief: `resend` is claimed but not installed (SMTP via `nodemailer` is the
actual email boundary). `shadcn/ui` is not a direct dependency; `@bizo/ui` uses shadcn-style
primitives built on CVA + clsx + tailwind-merge. Casbin is installed but its Prisma/PostgreSQL
adapter is not yet wired in.

## Decision drivers

- Honor ADR-0006's "No arbitrary code" and constrained in-house engine.
- Keep the $0 operating budget (PRD §1, §23).
- Preserve tenant and business isolation (ADR-0004).
- Permit a clean exit path without losing committed data.
- Avoid importing a foreign vocabulary that conflicts with the product language.
- Ship Stage B without a second framework migration.

## Options considered

### 1. Workflow / state-machine library (`xstate`, `robot3`)

- `xstate` 5.32.5 — MIT, 0 runtime dependencies, ~14 KB gzipped, 536 releases, last release
  2026-07-14, 3.6M weekly downloads, 0 known CVEs in the core package. Actor-based statecharts.
- `robot3` 1.2.0 — BSD-2-Clause, 0 dependencies, last release 2025-09-20, ~1M weekly downloads.
  Functional, immutable FSM.

Both are mature and permissively licensed. Both conflict with ADR-0006: that ADR explicitly chose a
constrained in-house engine over a general-purpose BPM/statechart vocabulary, and mandates "No
arbitrary code." xstate's statecharts/actor model and robot3's FSM semantics are foreign to bizOS's
product language (commercial documents, readiness, approvals). Either would require a custom
persistence layer to map machines to PostgreSQL rows, and would import concepts (SCXML, actors,
invoke) that the product owner has not asked for. The 10-criteria table below uses `xstate` as the
most tempting representative.

### 2. `casbin-prisma-adapter` 1.12.0

Apache-2.0, official Casbin adapter, supports PostgreSQL via Prisma 7.2+ (we are on 7.9.0), last
release 2026-02-01. Would persist Casbin policy in PostgreSQL instead of file or in-memory.

This is an ADR-0007 implementation concern, not a Stage B dependency. Stage B does not change the
authorization model; it adds configuration templates and workflow definitions that Casbin guards.
The adapter can be evaluated separately when the authorization service is wired to PostgreSQL.
Adding it now would couple Stage B to an authorization persistence decision that ADR-0007 has not
yet required.

### 3. `json-schema-to-ts` 3.1.1

MIT, 21.5M weekly downloads, pure type-space library, last release 2024-08-29 (slower cadence).
Infer TypeScript types from JSON Schema.

Redundant: `zod` 4.4.3 is already present across `@bizo/contracts`, `@bizo/config`, `apps/api`, and
`apps/web`, and provides both runtime validation and type inference from a single schema.
Introducing a second schema system would split validation across two libraries and double the
maintenance surface. Rejected.

### 4. Idempotent seed/migration helper

Prisma 7.9.0 already provides `prisma db seed` via `prisma.config.ts` and the standard `upsert`
pattern for idempotent seeding. No new dependency required for seeding Default ERP configuration
templates.

### 5. Versioning/diff utility (`jsondiffpatch` and similar)

For configuration template versions, storing the full immutable JSON snapshot per version is simpler
and more durable than computing deltas. This is the Frappe `Version` table pattern and the ADR-0013
`document_versions` pattern. A diff can always be computed on read from two snapshots; the snapshots
are the source of truth. No new dependency required.

## 10-criteria evaluation — `xstate` 5.32.5 (representative candidate)

| #   | Criterion                   | Assessment                                                                                                    |
| --- | --------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 1   | Approved requirement solved | Partial. Provides FSM semantics; does not solve versioning, persistence, guards-as-data, or audit.            |
| 2   | Licence compatibility       | MIT — permissive, compatible with bizOS.                                                                      |
| 3   | Security posture            | 0 CVEs in core; advisories are in dev deps (`happy-dom` in test harness). Clean.                              |
| 4   | Maintenance activity        | Very active. 536 releases, last 2026-07-14, 360 contributors, 118 open issues.                                |
| 5   | Architecture fit            | Moderate. Runs in Node.js, TypeScript-first. No Prisma/PostgreSQL persistence story; we would build it.       |
| 6   | Multi-tenant suitability    | Pure functions; can be scoped per tenant. No built-in tenant model.                                           |
| 7   | Zero-cost operation         | Yes. Self-hostable, no paid SaaS.                                                                             |
| 8   | Testing support             | Excellent. Model-based testing utilities; vitest compatible.                                                  |
| 9   | Upgrade path                | Semver. v4→v5 was a documented breaking change. v6 in alpha. Peer-dep coupling across `@xstate/*` packages.   |
| 10  | Removal / exit path         | Good. Pure functions; machines are data. But persisted machine definitions would need a migration on removal. |

The technical scores are strong. The strategic fit is not: ADR-0006 deliberately chose a constrained
engine over a general-purpose statechart library, and Stage B does not change that constraint.

## Decision

**Option A — No new dependencies.** Build the Default ERP configuration/workflow versioning
foundation with the existing stack: Prisma + PostgreSQL for template and version tables, Zod for
declarative validation and the guard DSL, Casbin for authorization, BullMQ + Redis for timers and
outbox dispatch, R2 for pack assets, and a small in-house state-machine interpreter that reads
immutable JSON workflow definitions.

Concretely:

- **Versioned configuration templates** — Prisma tables with immutable JSON snapshots per version,
  mirroring the `document_versions` pattern from ADR-0013.
- **Workflow templates** — Prisma tables storing JSON workflow definitions (states, transitions,
  actions, allowed roles, guard expressions). Versions are immutable and identified by a stable
  version id.
- **Guarded transitions** — a constrained JSON guard DSL validated by Zod, evaluated by a small
  in-house interpreter. No arbitrary JavaScript, no `eval`, no Python expressions. Guards reference
  document fields by path and support a fixed set of operators (equals, lt, gt, in, exists, etc.).
- **Business assignments** — existing `business_id` scoping pattern; a `business_configurations`
  table links each business to a published configuration version.
- **Document workflow context** — reuse the `documents`/`document_versions` tables from
  ADR-0013/0018; workflow state is a field on the document, not a separate graph.
- **Custom field definitions** — a `custom_field_definitions` table (tenant + business scoped,
  metadata-driven, Frappe-style) with values in a `custom_field_values` JSON column or table.
- **Industry packs** — versioned JSON packs stored in Prisma with assets in R2 under the existing
  `tenants/{tenantPublicId}/...` key scheme.
- **Feature flags** — a `feature_flags` table (tenant + business scoped).
- **Audit events** — existing audit pattern plus a Frappe-style structured JSON diff
  (added/changed/removed/row_changed) for field-level changes.
- **Idempotent seeding** — `prisma db seed` with `upsert` for the Default ERP template and industry
  packs.

`casbin-prisma-adapter` is explicitly deferred to a future ADR-0007 implementation review, not
blocked by Stage B.

## Frappe / ERPNext patterns worth adopting

Research-only. No migration, no code copy. A future migration to Frappe/ERPNext would require a
separate evidence-backed ADR and explicit product-owner approval.

**Adopt:**

1. **DocStatus vs Workflow State separation** — Frappe keeps system lifecycle (Draft/Submitted/
   Cancelled) separate from business approval state (Pending/Approved/Rejected). bizOS already does
   this implicitly; make it explicit: `DocumentStatus` for system lifecycle, `WorkflowState` for
   business approval.
2. **Workflow transition model** — `from_state + action + to_state + allowed_roles + guard`.
   Frappe's model is the canonical shape. bizOS replaces Frappe's arbitrary Python condition with a
   constrained JSON guard DSL (per ADR-0006).
3. **Naming Series** — per-prefix, per-business counters with year/month placeholders and a
   configurable start value. bizOS already does this in ADR-0013/0018; extend to all document types
   via `business_settings` per-type prefix + atomic `UPDATE … SET next = next + 1`.
4. **Custom fields as metadata, not columns** — Frappe stores custom field definitions in
   `tabCustom Field` and never alters core tables. bizOS should store custom field definitions in a
   `custom_field_definitions` table and values in a separate JSON store, so platform upgrades never
   conflict with business customizations.
5. **Version table for audit** — Frappe's `Version` Doctype stores structured JSON diffs
   (added/changed/removed/row_changed) per save. Adopt this format for field-level audit events.
6. **Role Profiles** — a named bundle of roles assignable to a user. Useful when businesses grow
   beyond OWNER/ADMIN/MEMBER.
7. **Submittable documents** — Frappe's "submittable" Doctypes become immutable on submit and
   trigger downstream effects. bizOS's `SENT` status in ADR-0013/0018 is the equivalent; keep this
   boundary strict.
8. **Print Format as template name** — server-side template identified by a stable name. bizOS
   already does this in ADR-0013; extend to all document types.
9. **Track Changes flag per type** — a per-document-type "versioning enabled" flag in the workflow
   template, so businesses can opt heavy transactional types into or out of field-level versioning.

**Do NOT adopt:**

1. **Arbitrary Python expressions in workflow conditions** — violates ADR-0006's "No arbitrary
   code." Use the constrained JSON guard DSL.
2. **`bench` and the Frappe monolithic framework** — bizOS is a NestJS/Next.js modular monolith, not
   a Frappe-style all-in-one framework.
3. **DocType as a universal dynamic table** — bizOS keeps typed Prisma models for core entities and
   uses metadata-driven custom fields only for extensions.
4. **Server scripts / hooks with arbitrary code** — ADR-0012 requires governed capability manifests
   and authorized application commands; no arbitrary server-side scripts.
5. **Migration to Frappe/ERPNext** — out of scope. Would require a separate evidence-backed ADR and
   explicit product-owner approval.

## Consequences

- Stage B ships without new runtime dependencies. The `package.json` files stay as verified.
- The in-house state-machine interpreter is a small, owned piece of code that must be tested (state
  coverage, guard evaluation, illegal-transition rejection) and documented.
- The guard DSL is a product surface: it must be expressive enough for Stage B approvals and
  readiness rules, but constrained enough to forbid arbitrary code. Expect a small Zod schema and a
  single evaluator function.
- `casbin-prisma-adapter` remains a candidate for a future ADR-0007 implementation ADR; it is not
  blocked by this decision.
- `resend` is not installed; email continues through the `nodemailer` SMTP boundary. Update the task
  brief's stack list if needed.
- No new license, security, or upgrade obligations are introduced.

## Validation and review trigger

Validate against the Stage B exit criteria: Default ERP template publishes and assigns to a new
business; configuration versions are immutable and reproducible; workflow transitions reject illegal
moves and unauthorized roles; guards evaluate deterministically; custom fields survive a platform
upgrade; audit events capture field-level diffs; seeding is idempotent under re-run; cross-tenant
denial holds.

Revisit this ADR when:

- a guard requirement cannot be expressed in the constrained DSL without contortions;
- long-running orchestration, timer volume, or recovery complexity exceeds the constrained engine
  (per ADR-0006's own trigger);
- ADR-0007 implementation requires durable Casbin policy in PostgreSQL;
- a Stage B capability is demonstrably cheaper, safer, and faster with a specific permissively
  licensed library, with a written exit path.
