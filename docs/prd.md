# bizOS Product Requirements Document (PRD)

**Document Version:** 5.0 (Authoritative Super-Set Baseline)  
**Status:** Approved Product Baseline  
**Date:** 2026-08-07  
**Product Owner:** Mohammed Wasim Perinkadakkat (`@pmwasim`)  
**Repository:** `pmwasim/bizOS` (`/home/wasim/bizOS`)  
**Production URL:** `https://bizos.qloudihub.com`  
**Budget Constraint:** Strictly $0 operating budget unless explicitly approved by the product owner.

---

## Table of Contents

1. [Executive Summary & Product Vision](#1-executive-summary--product-vision)
   - 1.1 [Executive Summary](#11-executive-summary)
   - 1.2 [Product Promise & Three Instant Questions](#12-product-promise--three-instant-questions)
   - 1.3 [Ten-Year Vision & Strategic Direction](#13-ten-year-vision--strategic-direction)
   - 1.4 [North-Star Metric](#14-north-star-metric)
   - 1.5 [Core Product Principles](#15-core-product-principles)
2. [Target Market, User Personas & Jobs-to-be-Done (JTBD)](#2-target-market-user-personas--jobs-to-be-done-jtbd)
   - 2.1 [Target Market & Positioning](#21-target-market--positioning)
   - 2.2 [Core User Personas](#22-core-user-personas)
   - 2.3 [Jobs-to-be-Done (JTBD) Matrix](#23-jobs-to-be-done-jtbd-matrix)
3. [Current Product State & Codebase Mapping](#3-current-product-state--codebase-mapping)
   - 3.1 [Production Baseline Overview](#31-production-baseline-overview)
   - 3.2 [Shipped API Controllers & Endpoints](#32-shipped-api-controllers--endpoints)
   - 3.3 [Shipped UI Routes & Pages](#33-shipped-ui-routes--pages)
   - 3.4
     [Shipped Database Schemas (32 Prisma Models)](#34-shipped-database-schemas-32-prisma-models)
   - 3.5 [Shipped Engine Implementation Details](#35-shipped-engine-implementation-details)
4. [Architecture Decision Records (ADR) Baseline](#4-architecture-decision-records-adr-baseline)
   - 4.1 [ADR Inventory & Core Positions](#41-adr-inventory--core-positions)
   - 4.2 [Superset & Non-Contradiction Guarantee](#42-superset--non-contradiction-guarantee)
5. [Detailed Roadmap Specifications (Phases 0 through 6)](#5-detailed-roadmap-specifications-phases-0-through-6)
   - 5.1
     [Phase 0: ERP Foundation & Customer-Experience Seam](#51-phase-0-erp-foundation--customer-experience-seam)
   - 5.2
     [Phase 1: MVP & Broader Document Workflow Core](#52-phase-1-mvp--broader-document-workflow-core)
   - 5.3 [Phase 2: Payments & Account Statements](#53-phase-2-payments--account-statements)
   - 5.4
     [Phase 3: Public APIs, Integrations & Visual Automations](#54-phase-3-public-apis-integrations--visual-automations)
   - 5.5 [Phase 4: CRM & Project Operations](#55-phase-4-crm--project-operations)
   - 5.6
     [Phase 5: Inventory Management & Extension Ecosystem](#56-phase-5-inventory-management--extension-ecosystem)
   - 5.7 [Phase 6: Autonomous AI Operating Layer](#57-phase-6-autonomous-ai-operating-layer)
6. [Detailed Feature Area Specifications (15 Areas, 75 User Stories)](#6-detailed-feature-area-specifications-15-areas-75-user-stories)
   - 6.1 [Feature Area 1: Quotations (Sales Core)](#61-feature-area-1-quotations-sales-core)
   - 6.2
     [Feature Area 2: Customer Invoices & Billing](#62-feature-area-2-customer-invoices--billing)
   - 6.3 [Feature Area 3: Payments & Collections](#63-feature-area-3-payments--collections)
   - 6.4 [Feature Area 4: Statements of Account](#64-feature-area-4-statements-of-account)
   - 6.5 [Feature Area 5: Credit Notes & Adjustments](#65-feature-area-5-credit-notes--adjustments)
   - 6.6 [Feature Area 6: Suppliers & Procurement](#66-feature-area-6-suppliers--procurement)
   - 6.7 [Feature Area 7: Inventory Management](#67-feature-area-7-inventory-management)
   - 6.8 [Feature Area 8: CRM & Lead Management](#68-feature-area-8-crm--lead-management)
   - 6.9 [Feature Area 9: Projects & Work Execution](#69-feature-area-9-projects--work-execution)
   - 6.10
     [Feature Area 10: Workflow Engine & Automations](#610-feature-area-10-workflow-engine--automations)
   - 6.11 [Feature Area 11: AI Operating Layer](#611-feature-area-11-ai-operating-layer)
   - 6.12
     [Feature Area 12: System Admin Portal & Configuration Engine](#612-feature-area-12-system-admin-portal--configuration-engine)
   - 6.13
     [Feature Area 13: Authentication & Role-Based Access Control (Auth/RBAC)](#613-feature-area-13-authentication--role-based-access-control-authrbac)
   - 6.14
     [Feature Area 14: Multi-Tenancy & Business Isolation](#614-feature-area-14-multi-tenancy--business-isolation)
   - 6.15
     [Feature Area 15: Compliance, Internationalization & Tax Engine](#615-feature-area-15-compliance-internationalization--tax-engine)
7. [Summary Matrix of User Stories & Acceptance Criteria](#7-summary-matrix-of-user-stories--acceptance-criteria)
8. [Current-State Gap Analysis Matrix](#8-current-state-gap-analysis-matrix)
9. [Architecture, Systems & Platform Design](#9-architecture-systems--platform-design)
   - 9.1
     [Information Architecture & Navigation Model](#91-information-architecture--navigation-model)
   - 9.2 [Data Model & Entity Relationships](#92-data-model--entity-relationships)
   - 9.3
     [Versioned Deterministic Workflow Engine & State Machines](#93-versioned-deterministic-workflow-engine--state-machines)
   - 9.4 [Authorization Model & Casbin RBAC](#94-authorization-model--casbin-rbac)
   - 9.5 [Multi-Tenancy & Business Isolation Model](#95-multi-tenancy--business-isolation-model)
   - 9.6
     [Internationalization (i18n), Localization (l18n) & Arabic RTL Strategy](#96-internationalization-i18n-localization-l18n--arabic-rtl-strategy)
   - 9.7
     [Country Compliance & Tax Engine Architecture](#97-country-compliance--tax-engine-architecture)
   - 9.8 [Monetization & Pricing Strategy](#98-monetization--pricing-strategy)
   - 9.9 [Integration & Developer API Strategy](#99-integration--developer-api-strategy)
   - 9.10 [Mobile & Multi-Platform Strategy](#910-mobile--multi-platform-strategy)
   - 9.11 [AI & Automation Roadmap](#911-ai--automation-roadmap)
10. [Governance, Success Metrics, Risks & Assumptions](#10-governance-success-metrics-risks--assumptions)
    - 10.1 [Phase Success Metrics & KPIs Table](#101-phase-success-metrics--kpis-table)
    - 10.2
      [Sequencing Constraints & Dependency Graph (DAG)](#102-sequencing-constraints--dependency-graph-dag)
    - 10.3
      [Risks, Mitigation Strategies & Assumptions](#103-risks-mitigation-strategies--assumptions)

---

## 1. Executive Summary & Product Vision

### 1.1 Executive Summary

bizOS is a workflow-first Business Operating System designed for small businesses, service
companies, freelancers, trade contractors, and growing commercial organizations. It bridges the gap
between complex enterprise ERPs (which demand specialized accounting knowledge) and lightweight
invoice tools (which lack audit compliance, purchase order tracking, and multi-tenant scalability).

bizOS runs on top of an upgradeable open-source ERP foundation (ERPNext/Frappe), wrapped in a
plain-language, guided customer experience layer. Every business created on bizOS receives an
immediate, fully functional standard configuration ("Default bizOS ERP"). Users can optionally
complete a brief setup questionnaire to apply an industry-specific configuration pack or request
System Admin customization—all on a single maintained multi-tenant platform without code forks or
instance fragmentation. Operating strictly under a **$0 budget constraint** (utilizing free tiers,
open-source leverage, and Cloudflare serverless hosting), bizOS guarantees exact financial
calculations (integer minor units), immutable issued records, and row-level database isolation.

### 1.2 Product Promise & Three Instant Questions

- **Product Promise:** _"Run the work. bizOS handles the paperwork."_ A new user can register,
  create a business, and issue commercial documents within 5 minutes. Customization is optional,
  reversible where safe, and never required to use the default ERP.
- **Three Instant Questions:** Every screen, dashboard, and document view in bizOS must immediately
  answer:
  1. _What needs my attention?_ (Clear queue of pending approvals, expiring quotes, or overdue
     invoices).
  2. _What happens next?_ (Guarded, explicit recommended actions such as "Convert to Invoice" or
     "Record Payment").
  3. _Is the business waiting on me or someone else?_ (Explicit hand-off visibility between sales,
     operations, finance, and external customers).

### 1.3 Ten-Year Vision & Strategic Direction

Over a ten-year horizon, bizOS evolves from an initial commercial document engine into an autonomous
business operating network:

- **Years 1–2 (Foundation & Core Transactions):** Document lifecycle (Quotation → PO → Invoice →
  Payment → Statement), ZATCA Phase 1 & 2 compliance, UAE VAT, Indian GST, and zero-budget
  serverless deployment.
- **Years 3–5 (Connected Operations & Ecosystem):** CRM, project progress billing, inventory
  movements, public developer APIs, webhooks, and visual automation rules.
- **Years 6–10 (Autonomous Operating Layer):** Governed AI assistants, OCR document intake,
  permission-filtered retrieval-augmented generation (RAG), and human-confirmed agent execution that
  handles routine administrative paperwork automatically.

### 1.4 North-Star Metric

The primary North-Star metric for bizOS product health is:  
**Median Time from Required Action to Correct Completion** (e.g., time elapsed from customer quote
acceptance to sent tax invoice).

### 1.5 Core Product Principles

1. **Default ERP First; Customization Optional:** Every business receives a valid published
   configuration fallback (`Default bizOS ERP`) upon creation. No unconfigured businesses are
   permitted.
2. **Plain Business Language First:** Formal accounting terms (debit, credit, posting, general
   ledger) are hidden behind operational actions ("Receive Payment", "Issue Invoice") and exposed
   only to explicit finance roles.
3. **One Maintained Platform:** Customization alters declarative configuration (modules, workflows,
   custom fields, rules), never codebase forks or dedicated server instances.
4. **Workflows as Primary Product Model:** Business workflows drive the primary user experience;
   documents and financial entries are durable outcomes of guarded state transitions.
5. **Exact Financial Calculations:** Money is stored as arbitrary-precision integer minor units
   (`numeric(38,0)` in PostgreSQL). Floating-point math is strictly prohibited. Tax rounding is
   deterministic.
6. **Immutable Issued Records:** Issuing a document creates an immutable JSON snapshot and S3/R2 PDF
   object. Corrections require explicit new versions, credit notes, or formal reversals.
7. **Tenant & Business Isolation by Design:** Security boundaries separate Tenants (billing
   accounts) and Businesses (operating legal entities). Database queries enforce PostgreSQL
   Row-Level Security (`FORCE RLS`) using GUC session variables (`app.tenant_id`,
   `app.business_id`).
8. **Mobile-Capable Core Journeys:** Core operational journeys must be fully responsive on mobile
   web with touch targets $\ge 44 \times 44\text{px}$ and WCAG 2.2 AA accessibility.
9. **Zero Budget Guarantee:** Platform infrastructure relies on free tiers (Cloudflare Workers/R2,
   Render Free, Prisma Postgres) with keep-warm guards, staying strictly within $0 monthly cost.

---

## 2. Target Market, User Personas & Jobs-to-be-Done (JTBD)

### 2.1 Target Market & Positioning

- **Primary Target:** Small service businesses, trade contractors, agencies, consultancies, and
  retail/wholesalers in Saudi Arabia, United Arab Emirates, and India with 1 to 50 employees.
- **Positioning:** Positioned above casual invoicing tools (which lack PO evidence and ZATCA/VAT
  compliance) and below traditional enterprise ERPs (like SAP or Oracle, which require long
  implementations and formal accounting staff).

### 2.2 Core User Personas

bizOS defines eight primary personas across business operations, finance, governance, and
integrations:

1. **Amina (Owner-Operator):** Runs 1–2 service businesses. Needs trusted executive summaries, cash
   visibility on mobile, quick document approvals, and zero administrative friction.
2. **Daniel (Operations Coordinator):** Handles daily quotes, customer PO intake, delivery tracking,
   and invoicing queues. Needs clear task queues, bulk-safe actions, and visible hand-offs.
3. **Noor (Intermittent Approver):** High-level manager or partner who reviews discount exceptions,
   large credit notes, or custom workflow steps. Needs concise evidence cards and one-click
   approvals.
4. **Ravi (Finance Specialist):** Accountant or tax consultant. Needs ZATCA/VAT compliance, gapless
   sequential numbering, bank reconciliation, audit trail logs, and formal accounting exports.
5. **External Contact (Customer / Supplier):** External party receiving quotes, invoices, or POs.
   Needs passwordless secure link access, clear document download, online payment, and bilingual
   viewing.
6. **Integration Dev (API Consumer / Developer):** Technical integrator connecting bizOS to web
   shops, custom apps, or CRMs. Needs REST/OpenAPI specs, sandbox environments, idempotency keys,
   and signed webhooks.
7. **Agent Operator (AI Assistant Supervisor):** Supervises AI copilots and automated workflows.
   Needs explainable AI previews, strict RBAC retrieval bounds, and explicit human click
   confirmation for financial actions.
8. **System Admin (Platform Engineer):** System administrator managing multi-tenant organizations,
   configuration templates, industry packs, custom field definitions, and system health metrics.

### 2.3 Jobs-to-be-Done (JTBD) Matrix

| Persona              | Primary Job-to-be-Done (JTBD)                                                                  | Desired Outcome                                                | Critical Failure Mode to Avoid                                     |
| -------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------ |
| **Amina**            | "Send formal proposal, get customer sign-off, and track cashflow without learning accounting." | Faster payment cycles and zero administrative stress.          | Dashboards presenting ledger jargon or complex setup menus.        |
| **Daniel**           | "Process customer POs, convert quotes to invoices, and notify clients when work is done."      | Error-free document hand-offs and clear operational queues.    | Ambiguous status labels ("Processed") that hide next steps.        |
| **Noor**             | "Review high-value discount proposals and approve credit adjustments safely."                  | Instant review with evidence context; zero fraud.              | Approval requests sent via plain email without verification proof. |
| **Ravi**             | "Ensure 100% tax compliance (ZATCA/VAT), gapless numbering, and audit-ready books."            | Deterministic tax reports and zero audit penalties.            | Friendly UI labels that conceal formal accounting totals.          |
| **External Contact** | "View quotation, approve terms online, and download PDF invoice or receipt."                   | Frictionless document access without mandatory account signup. | Demanding portal login for simple document viewing.                |
| **Integration Dev**  | "Sync sales order data into bizOS via API and receive real-time webhook updates."              | Stable REST contracts, predictable errors, and webhooks.       | Undocumented API behavior or webhooks without HMAC signatures.     |
| **Agent Operator**   | "Extract invoice data from incoming supplier PDFs using AI OCR and draft responses."           | Automated paperwork drafting with full human control.          | AI autonomously committing financial state changes.                |
| **System Admin**     | "Publish workflow templates and manage business configuration versions across tenants."        | Safe multi-tenant upgrades without data corruption.            | Unversioned template edits corrupting live business data.          |

---

## 3. Current Product State & Codebase Mapping

### 3.1 Production Baseline Overview

bizOS is implemented as a TypeScript monorepo using `pnpm` workspaces and `turbo`. The production
baseline is deployed and verified at `https://bizos.qloudihub.com`, backed by NestJS on Render Free
(`apps/api`), Next.js 15 on Cloudflare Workers (`apps/web`), and PostgreSQL with Prisma ORM.

### 3.2 Shipped API Controllers & Endpoints

All shipped REST endpoints reside in `apps/api/src/` under route prefix `/api/v1`:

- **Identity Controller** (`apps/api/src/identity/identity.controller.ts`):
  - `POST /api/v1/auth/signup` — User account registration.
  - `POST /api/v1/auth/verify` — Auth credential verification.
  - `GET /api/v1/me` — Current user profile and memberships.
- **Platform Controller** (`apps/api/src/platform/platform.controller.ts`):
  - `POST /api/v1/businesses` — Create business workspace.
  - `GET /api/v1/businesses/:id/settings` — Get business settings & tax profile.
  - `PUT /api/v1/businesses/:id/settings` — Update business settings.
- **Customers Controller** (`apps/api/src/customers/customers.controller.ts`):
  - `POST /api/v1/businesses/:id/customers` — Create customer contact.
  - `GET /api/v1/businesses/:id/customers` — List business customers.
  - `GET /api/v1/businesses/:id/customers/:customerId` — Get customer details.
  - `PUT /api/v1/businesses/:id/customers/:customerId` — Update customer.
- **Quotations Controller** (`apps/api/src/documents/quotations.controller.ts`):
  - `POST /api/v1/businesses/:id/quotations` — Create quotation (`Q-0001`).
  - `GET /api/v1/businesses/:id/quotations` — List quotations.
  - `GET /api/v1/businesses/:id/quotations/:quotationId` — Get quotation detail.
  - `GET /api/v1/businesses/:id/quotations/:quotationId/pdf` — Render PDF preview.
  - `POST /api/v1/businesses/:id/quotations/:quotationId/send` — Send quotation via SMTP & freeze
    snapshot.
- **Invoices Controller** (`apps/api/src/documents/invoices.controller.ts`):
  - `POST /api/v1/businesses/:id/invoices` — Convert quote into tax invoice (`INV-0001`).
  - `GET /api/v1/businesses/:id/invoices` — List business invoices.
  - `GET /api/v1/businesses/:id/invoices/:invoiceId` — Get invoice detail.
  - `PATCH /api/v1/businesses/:id/invoices/:invoiceId` — Edit draft invoice line items.
  - `POST /api/v1/businesses/:id/invoices/:invoiceId/mark-ready` — Mark invoice `READY_TO_SEND`.
  - `POST /api/v1/businesses/:id/invoices/:invoiceId/send` — Deliver invoice PDF via email.
  - `POST /api/v1/businesses/:id/invoices/:invoiceId/archive` — Archive draft invoice.
  - `GET /api/v1/businesses/:id/invoices/:invoiceId/pdf` — Render invoice PDF.
- **Purchase Orders Controller** (`apps/api/src/purchase-orders/purchase-orders.controller.ts`):
  - `POST /api/v1/businesses/:id/purchase-orders` — Record customer PO.
  - `GET /api/v1/businesses/:id/purchase-orders` — List customer POs.
  - `GET /api/v1/businesses/:id/purchase-orders/:id` — Get PO detail.
  - `PUT /api/v1/businesses/:id/purchase-orders/:id` — Update PO fields.
  - `POST /api/v1/businesses/:id/purchase-orders/:id/archive` — Archive PO.
  - `PATCH /api/v1/businesses/:id/purchase-orders/:id/approval` — Update approval status
    (`APPROVED`).
  - `POST /api/v1/businesses/:id/purchase-orders/:id/files/purchase-order` — Upload PO PDF file to
    R2.
  - `POST /api/v1/businesses/:id/purchase-orders/:id/files/approval-evidence` — Upload approval
    proof file to R2.
  - `GET /api/v1/businesses/:id/purchase-orders/:id/files/:fileId` — Download stored file.
- **Payments Controller** (`apps/api/src/payments/payments.controller.ts`):
  - `POST /api/v1/businesses/:id/payments` — Record payment.
  - `GET /api/v1/businesses/:id/payments` — List payments.
  - `GET /api/v1/businesses/:id/payments/:paymentId` — Payment details & allocations.
  - `PATCH /api/v1/businesses/:id/payments/:paymentId/status/complete` — Complete payment.
  - `PATCH /api/v1/businesses/:id/payments/:paymentId/status/reverse` — Reverse payment & restore
    balance.
- **Statements Controller** (`apps/api/src/statements/statements.controller.ts`):
  - `GET /api/v1/businesses/:id/statements/customers/:customerId` — Generate customer account
    statement.
- **Onboarding Controller** (`apps/api/src/onboarding/onboarding.controller.ts`):
  - `GET /api/v1/onboarding/questionnaire` — Get questionnaire structure.
  - `POST /api/v1/onboarding/recommend` — Recommendation engine.
  - `POST /api/v1/businesses/:id/onboarding/apply` — Apply configuration template.
- **Configuration Controller** (`apps/api/src/configuration/configuration.controller.ts`):
  - `GET /api/v1/businesses/:id/configuration` — Active configuration & custom fields.
  - `GET /api/v1/businesses/:id/modules` — Enabled module definitions.
  - `GET /api/v1/businesses/:id/documents/:id/workflow` — Active workflow state & rules.
- **System Admin Controller** (`apps/api/src/system-admin/system-admin.controller.ts`):
  - `GET /api/v1/system-admin/organizations` — List all tenant organizations.
  - `GET /api/v1/system-admin/organizations/:id` — Organization detail.
  - `POST /api/v1/system-admin/organizations/:id/assignment` — Assign configuration version.
  - `POST /api/v1/system-admin/configuration/default-erp-version` — Set platform default ERP
    version.
  - `GET /api/v1/system-admin/customization-requests` — Review customization requests.
  - `GET /api/v1/system-admin/audit-events` — View configuration audit events.
  - `GET /api/v1/system-admin/health` — Platform health check.
- **Customization Controller** (`apps/api/src/customization/customization.controller.ts`):
  - `POST /api/v1/businesses/:id/customization-requests` — Submit request.
  - `GET /api/v1/businesses/:id/customization-requests` — List business requests.
- **Health Controller** (`apps/api/src/health/health.controller.ts`):
  - `GET /api/v1/health` — API liveness & readiness check.

### 3.3 Shipped UI Routes & Pages

All frontend routes are implemented in `apps/web/src/app/`:

- `/` — Landing page & conditional workspace redirect (`apps/web/src/app/page.tsx`).
- `/signin` & `/signup` — Authentication pages (`apps/web/src/app/(auth)/`).
- `/start` — Guided Onboarding Questionnaire (`apps/web/src/app/start/page.tsx`).
- `/b/[businessId]` — Main Dashboard & Work Overview (`apps/web/src/app/b/[businessId]/page.tsx`).
- `/b/[businessId]/setup` — Mode Selection Choice (`Default ERP` vs `Guided Setup`).
- `/b/[businessId]/customers` & `/new` — Customer Directory & Creation Form.
- `/b/[businessId]/quotations`, `/new`, `/[quotationId]` — Quotation List, Builder, and
  Detail/Send/PO Intake.
- `/b/[businessId]/invoices`, `/[invoiceId]`, `/[invoiceId]/edit` — Invoice List, Detail/Send, and
  Line Editor.
- `/b/[businessId]/purchase-orders`, `/new`, `/[purchaseOrderId]` — Customer PO List, Creation, and
  File Evidence Upload.
- `/b/[businessId]/payments` & `/[paymentId]` — Payments List, Record Form, and Detail/Reversal.
- `/b/[businessId]/statements` — Customer Statement Generator & Aging Breakdown.
- `/b/[businessId]/settings`, `/setup`, `/customization` — Business Settings & Request
  Customization.
- `/admin`, `/organizations`, `/default-erp`, `/templates`, `/customization-requests`,
  `/audit-events` — System Admin Platform Management Portal (`apps/web/src/app/admin/`).

### 3.4 Shipped Database Schemas (32 Prisma Models)

The production database schema (`packages/database/prisma/schema.prisma`) defines 32 core models:

1. `User` — Account credentials, identity, and profile.
2. `Tenant` — Commercial billing tenant boundary.
3. `Membership` — User mapping to Tenant with assigned Role.
4. `Role` — Definition of system roles (`OWNER`, `ADMIN`, `MEMBER`, `ACCOUNTANT`, `AUDITOR`).
5. `Business` — Legal operating entity belonging to a Tenant.
6. `BusinessAccess` — User mapping to Business.
7. `PlatformSystemAdmin` — System Administrator authorization privileges.
8. `BusinessSettings` — Business currency, tax defaults, and document numbering sequence flags.
9. `TaxProfile` — Jurisdictional tax profile (VAT/GST registration number, rate PPM).
10. `Customer` — Customer entity, contact info, billing addresses, tax ID.
11. `Document` — Shared fact model for `QUOTATION` and `INVOICE`.
12. `DocumentLine` — Line item quantity, unit price, tax rate PPM, minor unit total.
13. `DocumentVersion` — Immutable JSON snapshot of issued documents.
14. `DocumentDelivery` — Email delivery log (SMTP status, attempts, error log).
15. `PurchaseOrder` — Inbound Customer PO aggregate and approval status.
16. `StoredObject` — Metadata for private R2 files (PO PDFs, approval evidence).
17. `Payment` — Inbound/outbound money movement record.
18. `PaymentAllocation` — Payment allocation mapping to Document with minor unit amount.
19. `ModuleDefinition` — System module catalog definition.
20. `ConfigurationTemplate` — Blueprint configuration container.
21. `ConfigurationTemplateVersion` — Immutable versioned configuration JSON definition.
22. `WorkflowTemplate` — Workflow definition container.
23. `WorkflowTemplateVersion` — Immutable versioned state machine JSON definition.
24. `BusinessConfigurationAssignment` — Mapping of Business to active configuration version.
25. `DocumentWorkflowContext` — State machine runtime instance attached to Document.
26. `CustomFieldDefinition` — Dynamic schema field definitions per business.
27. `IndustryPack` — Pre-packaged configuration bundles for specific verticals.
28. `FeatureFlag` — Tenant and business feature toggles.
29. `AuditEvent` — Immutable application audit log.
30. `ConfigurationAuditEvent` — Platform configuration audit log.
31. `CustomizationRequest` — Customer customization requests submitted to System Admin.
32. `OutboxEvent` — Transactional outbox event queue for asynchronous side-effects (SMTP, webhooks,
    background jobs).

### 3.5 Shipped Engine Implementation Details

- **Money Arithmetic (`packages/contracts/src/money.ts`):** Integer minor units using
  `numeric(38,0)` in PostgreSQL. Formats minor units into display strings using ISO currency codes
  and explicit scale. Implements `roundDivide` for deterministic half-up rounding.
- **Workflow Guard Interpreter (`apps/api/src/configuration/guard-interpreter.ts`):** Deterministic
  evaluation of workflow AST condition trees (`eq`, `neq`, `lt`, `lte`, `gt`, `gte`, `in`, `notIn`,
  `exists`, `notExists`). Completely eliminates unsafe JavaScript `eval` or dynamic code execution.
- **ZATCA Phase 1 TLV Encoder (`packages/contracts/src/zatca.ts`):** Pure Tag-Length-Value (TLV)
  encoder producing Base64 string tags for Seller Arabic Name (Tag 1), VAT Registration Number (Tag
  2), Timestamp (Tag 3), Total with VAT (Tag 4), and VAT Amount (Tag 5).
- **Multi-Tenant Row-Level Security (`apps/api/src/database/database.service.ts`):** Enforces
  PostgreSQL `FORCE RLS` on every entity table. `DatabaseService.withScope(access, tx)` sets session
  GUCs (`SET LOCAL app.tenant_id`, `SET LOCAL app.business_id`) before running Prisma queries,
  preventing cross-tenant data leaks at the database engine level.
- **Casbin RBAC Security (`apps/api/src/security/`):** Evaluates authorization policy
  `(sub, dom, obj, act)` where `dom` = `tenantPublicId:businessPublicId`. Guard middleware
  (`BusinessAccessService`, `SystemAdminGuard`) gates endpoint execution.

---

## 4. Architecture Decision Records (ADR) Baseline

### 4.1 ADR Inventory & Core Positions

The bizOS product architecture is governed by 22 Architecture Decision Records located in
`docs/decisions/`. All positions are accepted and maintained:

| ADR #        | File & Title                                                                                                                     | Status     | Core Architectural Position                                                                                          |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------- |
| **ADR-0001** | [`decisions/0001-record-architecture-decisions.md`](decisions/0001-record-architecture-decisions.md)                             | Accepted   | Record durable architecture decisions as lightweight markdown ADRs in `docs/decisions/`.                             |
| **ADR-0002** | [`decisions/0002-pnpm-turborepo-monorepo.md`](decisions/0002-pnpm-turborepo-monorepo.md)                                         | Accepted   | Use pnpm workspaces with exact dependency pin and Turborepo for task graph execution & caching.                      |
| **ADR-0003** | [`decisions/0003-modular-monolith.md`](decisions/0003-modular-monolith.md)                                                       | Accepted   | Build a NestJS modular monolith on a single transactional PostgreSQL database; modules talk via outbox events.       |
| **ADR-0004** | [`decisions/0004-tenant-and-business-boundaries.md`](decisions/0004-tenant-and-business-boundaries.md)                           | Accepted   | Separate Tenant (billing account) and Business (legal entity). Require `(tenant_id, business_id)` on all queries.    |
| **ADR-0005** | [`decisions/0005-postgresql-and-prisma.md`](decisions/0005-postgresql-and-prisma.md)                                             | Accepted   | PostgreSQL is system of record; Prisma manages client generation, migrations, and repository data access.            |
| **ADR-0006** | [`decisions/0006-versioned-workflow-engine.md`](decisions/0006-versioned-workflow-engine.md)                                     | Accepted   | In-house versioned state machine engine: guarded transitions, JSON AST conditions, outbox events, BullMQ queues.     |
| **ADR-0007** | [`decisions/0007-casbin-authorization.md`](decisions/0007-casbin-authorization.md)                                               | Accepted   | Use Casbin embedded policy engine for RBAC/ABAC evaluation with `(sub, dom, obj, act)` inputs.                       |
| **ADR-0008** | [`decisions/0008-money-representation.md`](decisions/0008-money-representation.md)                                               | Accepted   | Represent money as integer minor units (`numeric(38,0)` in DB) with explicit ISO currency code and scale.            |
| **ADR-0009** | [`decisions/0009-authjs-session-boundary.md`](decisions/0009-authjs-session-boundary.md)                                         | Accepted   | NextAuth at web boundary; NestJS API validates internal JWT token assertions.                                        |
| **ADR-0010** | [`decisions/0010-outbox-bullmq-r2.md`](decisions/0010-outbox-bullmq-r2.md)                                                       | Accepted   | PostgreSQL = durable truth; BullMQ/Redis = queued jobs; Cloudflare R2 = private S3 object storage.                   |
| **ADR-0011** | [`decisions/0011-rest-openapi-contracts.md`](decisions/0011-rest-openapi-contracts.md)                                           | Accepted   | Resource-oriented REST APIs documented with OpenAPI 3.0, RFC 9457 errors, cursor pagination, and webhooks.           |
| **ADR-0012** | [`decisions/0012-governed-extensions-and-ai.md`](decisions/0012-governed-extensions-and-ai.md)                                   | Accepted   | Extensions declare capability manifests; AI retrieval permission-filtered with human click confirmation.             |
| **ADR-0013** | [`decisions/0013-quotation-document-slice.md`](decisions/0013-quotation-document-slice.md)                                       | Accepted   | Shared `documents` table; `QUOTATION` type; immutable JSON snapshots, PDF rendering, and SMTP delivery.              |
| **ADR-0014** | [`decisions/0014-single-maintainer-branch-protection.md`](decisions/0014-single-maintainer-branch-protection.md)                 | Accepted   | Single maintainer (@pmwasim): strict CI status checks, linear history, force-push block, 0 required PR review count. |
| **ADR-0015** | [`decisions/0015-managed-hosting-behind-cloudflare.md`](decisions/0015-managed-hosting-behind-cloudflare.md)                     | Accepted   | Deployed on Render Free behind Cloudflare DNS/TLS (strict) with Prisma Postgres database.                            |
| **ADR-0016** | [`decisions/0016-purchase-order-approval-readiness.md`](decisions/0016-purchase-order-approval-readiness.md)                     | Accepted   | Introduce `purchase_orders` & `stored_objects` tables; readiness state machine (`READY_TO_INVOICE`, etc.).           |
| **ADR-0017** | [`decisions/0017-po-object-storage.md`](decisions/0017-po-object-storage.md)                                                     | Accepted   | `@bizo/storage` S3 abstraction layer: `R2ObjectStore` for prod, `LocalObjectStore` for local CI/dev testing.         |
| **ADR-0018** | [`decisions/0018-invoice-document-slice.md`](decisions/0018-invoice-document-slice.md)                                           | Accepted   | Add `INVOICE` document type; convert from ready quotation; status flow (`DRAFT` → `READY_TO_SEND` → `SENT`).         |
| **ADR-0019** | [`decisions/0019-open-source-leverage-default-erp-foundation.md`](decisions/0019-open-source-leverage-default-erp-foundation.md) | Superseded | Evaluated open-source stack patterns; superseded by ADR-0020 and ADR-0021.                                           |
| **ADR-0020** | [`decisions/0020-configuration-aware-invoice-conversion.md`](decisions/0020-configuration-aware-invoice-conversion.md)           | Accepted   | `ConfigurationService.getInvoiceConversionPolicy` inspects active workflow rules for PO readiness gating.            |
| **ADR-0021** | [`decisions/0021-erpnext-foundation-customer-experience.md`](decisions/0021-erpnext-foundation-customer-experience.md)           | Accepted   | ERPNext/Frappe is underlying ERP foundation; bizOS is plain-language UI; dual-mode toggle supported.                 |
| **ADR-0022** | [`decisions/0022-web-tier-cloudflare-workers-hosting-split.md`](decisions/0022-web-tier-cloudflare-workers-hosting-split.md)     | Proposed   | Web tier (`apps/web`) deployed to Cloudflare Workers via OpenNext; API backend remains on Render Free.               |

### 4.2 Superset & Non-Contradiction Guarantee

This PRD (`docs/prd.md`) acts as an authoritative superset over
[`product-requirements.md`](product-requirements.md), [`vision.md`](vision.md), and
[`roadmap.md`](roadmap.md). No accepted positions from ADR-0001 through ADR-0022 are dropped or
altered. Where this document extends roadmap details (e.g., specifying CRM, Projects, Inventory, AI
OCR, and Payment Gateways), it does so while strictly adhering to the architectural constraints
established in the ADR inventory.

---

## 5. Detailed Roadmap Specifications (Phases 0 through 6)

The bizOS delivery roadmap maps outcome phases across functional stages:

```text
Phase 0: ERP Foundation & Seam  -->  Phase 1: MVP & Document Core  -->  Phase 2: Payments & Statements
                                                                                      │
Phase 6: AI Operating Layer     <--  Phase 5: Inventory & Extensions <--  Phase 4: CRM & Projects  <--  Phase 3: APIs & Automations
```

### 5.1 Phase 0: ERP Foundation & Customer-Experience Seam

- **Objective:** Establish the multi-tenant core, versioned configuration engine, security
  boundaries, and zero-budget deployment pipeline.
- **Key Deliverables:** Account registration, business switcher, dual interface toggle (Guided bizOS
  vs Standard ERPNext), quotation creation, Chromium PDF preview, SMTP delivery, customer PO intake,
  readiness check engine, invoice conversion, and System Admin portal.
- **Exit Criteria:** Upgrade rehearsal preserves configured data; 1 end-to-end journey verified
  under 5 minutes; WCAG 2.2 AA responsive UI; 0 cross-tenant data leakages in automated CI.

### 5.2 Phase 1: MVP & Broader Document Workflow Core

- **Objective:** Expand commercial document lifecycles and operational coordination across sales and
  initial procurement.
- **Key Deliverables:** Customer Directory, Sales Orders (`DocumentType.SALES_ORDER`), Delivery
  Notes (goods fulfillment), Service Completion proofs, Purchase Requests, Supplier RFQs, Supplier
  Quotations, Supplier POs (`SupplierPurchaseOrder`), Goods Receipt Notes (GRN), Supplier Bills, and
  workflow task assignments with due-time tracking.
- **Exit Criteria:** Multi-tenant test suite pass; country-neutral money/tax primitives verified;
  clear domain separation between Customer POs (inbound) and Supplier POs (outbound).

### 5.3 Phase 2: Payments & Account Statements

- **Objective:** End-to-end receivables and payables settlement, account statements, payment gateway
  collection, and accounting export.
- **Key Deliverables:** Payment recording (`Payment`), multi-document payment allocations
  (`PaymentAllocation`), partial payments, overpayment credits, payment receipts (`Receipt`),
  payment reversals, customer Account Statements (`Statement`), supplier Account Statements, cash
  flow dashboard, and accounting system export (CSV/JSON).
- **Exit Criteria:** Allocation sum cannot exceed payment total; statement balances reconcile to
  document ledger evidence; zero stored payment card credentials.

### 5.4 Phase 3: Public APIs, Integrations & Visual Automations

- **Objective:** Open bizOS to external systems via developer APIs, webhooks, third-party
  connectors, and visual workflow automation rules.
- **Key Deliverables:** Versioned REST/OpenAPI developer portal, API key scoping, signed webhooks
  (`X-BizOS-Signature`), sandbox tenants, rate-limiting, accounting connectors (Xero, QuickBooks),
  tax connectors (ZATCA Phase 2, EmaraTax, GST Portal), and visual rule builder powered by the AST
  formula engine.
- **Exit Criteria:** Webhook HMAC signature verified; API access tokens enforced; sandbox tenant
  isolation proven.

### 5.5 Phase 4: CRM & Project Operations

- **Objective:** Connect pre-sales customer acquisition and post-sales project delivery directly to
  financial document flows.
- **Key Deliverables:** CRM Leads, Opportunities, deal pipeline Kanban, interaction timeline,
  Project entities, Milestones, Time & Cost tracking, progress/milestone invoicing, and mobile field
  execution views.
- **Exit Criteria:** Project milestone invoicing reconciles with contract totals; field work
  execution operates responsively on mobile web.

### 5.6 Phase 5: Inventory Management & Extension Ecosystem

- **Objective:** Physical stock tracking, multi-location movements, valuation boundaries, and
  marketplace extensions.
- **Key Deliverables:** Items/Products catalog, Warehouse locations, Stock movements
  (in/out/transfer), Stock reservations, Valuation boundaries (FIFO/moving average), signed plugin
  manifests, isolated runtime sandboxes, marketplace billing, and entitlement meters.
- **Exit Criteria:** Non-inventory service businesses operate without stock fields; plugin sandboxes
  strictly forbid direct DB access or unauthorized network pings.

### 5.7 Phase 6: Autonomous AI Operating Layer

- **Objective:** Intelligent natural language reporting, PDF OCR extraction, draft generation,
  anomaly detection, and human-in-the-loop agent execution.
- **Key Deliverables:** Permission-filtered RAG search, PDF/Receipt OCR parser, payment matching
  suggestions, automated reminder drafts, anomaly alerts, and human click confirmation bounds for
  high-impact actions.
- **Exit Criteria:** 100% of autonomous financial write proposals require explicit human
  confirmation; AI retrieval strictly respects Casbin tenant/business boundaries.

---

## 6. Detailed Feature Area Specifications (15 Areas, 75 User Stories)

Below are the detailed specifications for all 15 feature areas. Each area contains all 6 required
subsections and exactly 5 user stories with matching acceptance criteria (`AC-XXX-YY`).

---

### 6.1 Feature Area 1: Quotations (Sales Core)

#### 1. Description & Business Value

The Quotations module enables sales teams and business owners to draft, calculate, approve, and
deliver commercial proposals to prospective customers. It enforces exact minor-unit money
arithmetic, tax calculations, customer PO attachment, and seamless conversion to tax invoices.

#### 2. User Stories

- **US-QUOTE-01:** _As an Owner-Operator (Amina), I want to create a formal quotation on my phone,
  so that I can capture a commercial opportunity immediately after a customer meeting._
- **US-QUOTE-02:** _As an Operations Coordinator (Daniel), I want to attach customer PO evidence and
  approval documents to a quotation, so that our team has verified proof before marking the quote
  ready to invoice._
- **US-QUOTE-03:** _As an Intermittent Approver (Noor), I want to receive an explicit approval
  request for high-discount quotes with a term summary and margin alert, so that I can approve or
  reject the quote without navigating complex menus._
- **US-QUOTE-04:** _As a Finance Specialist (Ravi), I want all quotation tax calculations to enforce
  exact integer minor unit rounding with explicit tax profiles, so that output totals match tax
  authority requirements._
- **US-QUOTE-05:** _As an External Contact, I want to open a secure link to view, accept, or request
  revisions on a quotation online without creating an account, so that I can confirm orders
  quickly._

#### 3. Acceptance Criteria

- **AC-QUOTE-01:** Mobile interface renders responsive quote creation form with line item
  autocomplete and instant total calculation in under 1 second.
- **AC-QUOTE-02:** Uploading customer PO PDF or image creates an immutable document attachment
  (`StoredObject`) and enables transition to `PO_ATTACHED` state.
- **AC-QUOTE-03:** Quotes exceeding configured discount threshold (e.g. >15%) trigger an approval
  task assigned to `Approver` role; transition to `APPROVED` is blocked until authorized.
- **AC-QUOTE-04:** Line items compute tax using integer minor units
  (`minorUnits = Math.round(price * qty * taxPpm / 1000000)`), avoiding float rounding
  discrepancies.
- **AC-QUOTE-05:** Public quote acceptance portal presents single-click "Accept Quote" button which
  records digital acceptance timestamp, IP address, and updates status to `ACCEPTED`.

#### 4. Priority Classification

**Must-Have** (Core MVP baseline; shipped and verified).

#### 5. Dependencies

Customer Directory, Business Settings, Tax Profiles, PDF Renderer (`Chromium`), R2 Storage.

#### 6. Success Metrics

Quotation creation time $< 2$ minutes; 100% exact match between quote totals and rendered PDF bytes.

---

### 6.2 Feature Area 2: Customer Invoices & Billing

#### 1. Description & Business Value

The Invoices module generates legally compliant, immutable tax invoices from accepted quotations,
sales orders, or direct manual entry. It handles country compliance rules (ZATCA Phase 1 & 2 QR
codes, UAE VAT, Indian GST), bilingual Arabic/English PDF rendering, atomic sequential numbering,
and email distribution.

#### 2. User Stories

- **US-INV-01:** _As an Operations Coordinator (Daniel), I want to convert a "Ready to Invoice"
  quotation into a formal tax invoice with one click, so that billing is fast and error-free._
- **US-INV-02:** _As a Finance Specialist (Ravi), I want invoices to generate sequential,
  business-local atomic numbers (e.g., `INV-2026-0001`), so that our invoice sequence is gapless and
  audit-compliant._
- **US-INV-03:** _As an Owner-Operator (Amina) operating in Saudi Arabia, I want generated invoice
  PDFs to be fully bilingual (Arabic/English) with a compliant ZATCA Phase 1 TLV QR code, so that my
  business meets ZATCA e-invoicing standards._
- **US-INV-04:** _As an Operations Coordinator (Daniel), I want to issue a formal invoice and send
  it to the customer via SMTP with a downloadable PDF attachment, so that the customer receives
  billing immediately._
- **US-INV-05:** _As a Finance Specialist (Ravi), I want issued invoices to become strictly
  immutable, so that historical tax records cannot be altered without a formal Credit Note or Debit
  Note._

#### 3. Acceptance Criteria

- **AC-INV-01:** Conversion from Quote to Invoice copies all line items, terms, custom fields, and
  customer tax registration numbers faithfully without re-entry.
- **AC-INV-02:** Atomic numbering generator uses database locking per organization to guarantee
  gapless sequential numbering even under concurrent creation.
- **AC-INV-03:** PDF renderer uses Headless Chromium path to render bilingual Arabic RTL / English
  LTR text with valid ZATCA TLV Base64 QR code encoding seller name, VAT number, timestamp, total,
  and VAT amount.
- **AC-INV-04:** SMTP email engine dispatches invoice email with attached PDF, logging delivery
  status, attempts, timestamp, and message ID in `DocumentDelivery`.
- **AC-INV-05:** Post-issuance edit requests on `SENT` or `ISSUED` status invoices are rejected
  server-side with HTTP 409 Conflict error.

#### 4. Priority Classification

**Must-Have** (Core MVP baseline; shipped and verified).

#### 5. Dependencies

Quotations Module, Tax Engine, Multi-Tenant Database, Chromium PDF Renderer, ZATCA TLV Package.

#### 6. Success Metrics

Invoice generation latency $< 1.5$ seconds; 0% gap rate in sequential invoice numbers.

---

### 6.3 Feature Area 3: Payments & Collections

#### 1. Description & Business Value

The Payments module tracks incoming customer payments and outgoing supplier payments. It handles
manual offline payments (cash, bank transfer, check) and online gateway collections, multi-invoice
allocations, partial payments, overpayment credits, and payment receipts.

#### 2. User Stories

- **US-PAY-01:** _As an Operations Coordinator (Daniel), I want to record an offline customer bank
  transfer against an unpaid invoice, so that the invoice status updates to Paid immediately._
- **US-PAY-02:** _As a Finance Specialist (Ravi), I want to allocate a single large customer payment
  across multiple open invoices, so that accounts receivable balances reflect exact document-level
  allocations._
- **US-PAY-03:** _As an Owner-Operator (Amina), I want to send customers an online Payment Link via
  SMS/Email, so that they can pay instantly using credit card or digital wallets._
- **US-PAY-04:** _As a Finance Specialist (Ravi), I want overpayments to be automatically recorded
  as unallocated customer credit, so that future invoices can absorb the balance._
- **US-PAY-05:** _As an External Contact, I want to receive an official Payment Receipt PDF
  immediately upon payment completion, so that I have record of payment for my books._

#### 3. Acceptance Criteria

- **AC-PAY-01:** Recording offline payment updates invoice `paidMinor`, recalculates
  `outstandingMinor`, and sets status to `PAID` or `PARTIALLY_PAID`.
- **AC-PAY-02:** Multi-allocation UI validates that sum of line allocations does not exceed total
  payment amount, creating explicit `PaymentAllocation` records per invoice.
- **AC-PAY-03:** Payment links integrate with Stripe/checkout gateway, processing webhooks with
  idempotency keys to prevent duplicate payment creation.
- **AC-PAY-04:** Overpayment amount ($1,200 payment on $1,000 invoice) allocates
  $1,000 to invoice and logs $200 in `CustomerCredit` table.
- **AC-PAY-05:** Payment receipt PDF is generated automatically upon payment commitment and emailed
  to primary customer contact.

#### 4. Priority Classification

**Must-Have** (Offline payment recording: Shipped; Online Payment links: Phase 2 Must-Have).

#### 5. Dependencies

Invoices Module, Customer Directory, Payment Gateway API (Stripe/Checkout), PDF Engine.

#### 6. Success Metrics

Payment recording latency $< 500\text{ms}$; 100% allocation accuracy with 0 phantom credits.

---

### 6.4 Feature Area 4: Statements of Account

#### 1. Description & Business Value

Account Statements provide clear, real-time summaries of financial transactions and running balances
between a business and its customers or suppliers. They offer aging breakdowns, period filtering,
and downloadable PDF statements to accelerate collection and reconciliation.

#### 2. User Stories

- **US-STMT-01:** _As a Finance Specialist (Ravi), I want to generate a Customer Statement of
  Account for any date range, showing opening balance, invoices, payments, credit notes, and closing
  balance, so that I can provide customers with an accurate record of their transaction history._
- **US-STMT-02:** _As an Operations Coordinator (Daniel), I want to view an aging summary on
  customer statements (Current, 1-30 days, 31-60 days, 61-90 days, 90+ days overdue), so that I can
  prioritize collections follow-up._
- **US-STMT-03:** _As an Owner-Operator (Amina), I want to send monthly automated account statements
  to all customers with overdue balances via email, so that cash collection is systematically
  maintained._
- **US-STMT-04:** _As a Finance Specialist (Ravi), I want to generate a Supplier Statement of
  Account, so that I can reconcile what we owe a key vendor before processing batch payouts._
- **US-STMT-05:** _As an External Contact, I want to download a bilingual Statement PDF with payment
  details and bank transfer instructions, so that our accounts payable team can process settlement._

#### 3. Acceptance Criteria

- **AC-STMT-01:** Statement balances are derived strictly from immutable document ledgers:
  `Closing Balance = Opening Balance + Invoices - Payments - Credit Notes`.
- **AC-STMT-02:** Aging buckets calculate days overdue relative to invoice `dueDate` and group
  outstanding amounts accurately into 5 standard time bands.
- **AC-STMT-03:** Scheduled cron job triggers monthly statement dispatch for accounts with
  `outstandingMinor > 0`, logging email events.
- **AC-STMT-04:** Supplier statement consolidates supplier bills, payment vouchers, debit notes, and
  net payable balance accurately.
- **AC-STMT-05:** Statement PDF includes business bank IBAN/SWIFT details, customer Tax Registration
  Number, and running balance table formatted in Chromium PDF engine.

#### 4. Priority Classification

**Phase 2 Must-Have** (On-the-fly customer statement shipped; full aging/scheduled dispatch: Phase
2).

#### 5. Dependencies

Invoices Module, Payments Module, Customer Directory, PDF Engine.

#### 6. Success Metrics

Statement generation time $< 2$ seconds for accounts with up to 10,000 transactions.

---

### 6.5 Feature Area 5: Credit Notes & Adjustments

#### 1. Description & Business Value

The Credit Notes module allows businesses to issue legal accounting adjustments for returned goods,
billing corrections, discounts, or order cancellations without mutating historical issued invoices.

#### 2. User Stories

- **US-CN-01:** _As a Finance Specialist (Ravi), I want to issue a Credit Note linked to a specific
  issued invoice, so that billing errors or discounts are formally corrected according to accounting
  standards._
- **US-CN-02:** _As an Operations Coordinator (Daniel), I want to issue a standalone Credit Note for
  customer goodwill or pre-approved volume rebates, so that credit is added to their account._
- **US-CN-03:** _As a Finance Specialist (Ravi), I want to apply an active Credit Note to reduce the
  balance of an open invoice or convert it into a cash refund, so that the customer account balances
  correctly._
- **US-CN-04:** _As an Owner-Operator (Amina) in Saudi Arabia, I want Credit Notes to generate
  bilingual ZATCA-compliant PDFs with referenced invoice numbers, so that tax compliance is
  maintained._
- **US-CN-05:** _As an Intermittent Approver (Noor), I want any Credit Note exceeding $500 to
  require manager approval before issuance, so that financial risk is controlled._

#### 3. Acceptance Criteria

- **AC-CN-01:** Invoice-linked Credit Note auto-populates line items from target invoice, preventing
  credit amounts from exceeding original invoice line totals.
- **AC-CN-02:** Standalone Credit Note assigns sequential `CN-YYYY-XXXX` atomic number and credits
  customer ledger balance upon posting.
- **AC-CN-03:** Applying credit note to open invoice creates an explicit `CreditNoteAllocation`
  record and reduces invoice `outstandingMinor`.
- **AC-CN-04:** Rendered Credit Note PDF includes mandatory regulatory reference to original tax
  invoice number, date, and reason for issuance.
- **AC-CN-05:** Server enforces approval guard: Credit Notes above threshold remain in
  `DRAFT_APPROVAL` until approved by authorized role.

#### 4. Priority Classification

**Phase 2 Must-Have**.

#### 5. Dependencies

Invoices Module, Payments Module, Tax Engine, Workflow Engine.

#### 6. Success Metrics

100% audit compliance for invoice adjustments (zero direct database edits to issued invoices).

---

### 6.6 Feature Area 6: Suppliers & Procurement

#### 1. Description & Business Value

The Suppliers & Procurement module manages vendor master data, outbound Purchase Orders (POs),
supplier bill intake, 3-way matching, and goods receipt notes, providing total visibility into
operating expenses.

#### 2. User Stories

- **US-SUPP-01:** _As an Operations Coordinator (Daniel), I want to maintain a centralized Supplier
  Directory with contact info, tax registration numbers, payment terms, and bank details, so that
  procurement data is clean and accessible._
- **US-SUPP-02:** _As an Operations Coordinator (Daniel), I want to create and issue a formal
  Supplier Purchase Order (PO), so that our vendors receive clear order instructions._
- **US-SUPP-03:** _As a Finance Specialist (Ravi), I want to record incoming Supplier Bills against
  issued POs (2-way / 3-way matching), so that we only pay for goods/services actually ordered and
  received._
- **US-SUPP-04:** _As an Operations Coordinator (Daniel), I want to record Goods Receipt Notes (GRN)
  upon delivery of physical items, so that inventory levels and order completion are accurate._
- **US-SUPP-05:** _As an Owner-Operator (Amina), I want a summary report of upcoming supplier
  payments due over the next 30 days, so that I can plan cash flow effectively._

#### 3. Acceptance Criteria

- **AC-SUPP-01:** Supplier master stores tax numbers, CR numbers, payment terms (e.g. Net 30), and
  IBAN, with duplicate tax registration warnings.
- **AC-SUPP-02:** Supplier PO generation creates sequential `PO-YYYY-XXXX` document, renders
  printable PDF, and tracks status (`ISSUED`, `PARTIALLY_RECEIVED`, `CLOSED`).
- **AC-SUPP-03:** Supplier Bill creation performs 3-way match checking quantity and unit price
  against PO and Goods Receipt, flagging variances >2%.
- **AC-SUPP-04:** Recording Goods Receipt updates PO line item `receivedQuantity` and posts stock
  movement records if inventory is enabled.
- **AC-SUPP-05:** Supplier accounts payable report outputs cash requirement forecast grouped by
  payment due dates.

#### 4. Priority Classification

**Phase 1 / Phase 2 Must-Have**.

#### 5. Dependencies

Party Aggregate, Tax Engine, PDF Engine, Payments Module.

#### 6. Success Metrics

Elimination of vendor overbilling errors via 3-way matching (>99% accuracy).

---

### 6.7 Feature Area 7: Inventory Management

#### 1. Description & Business Value

The Inventory module provides physical goods tracking, multi-warehouse location movements, reorder
point alerts, and stock valuation (FIFO/Moving Average), remaining optional so service companies
avoid stock overhead.

#### 2. User Stories

- **US-INVT-01:** _As an Operations Coordinator (Daniel), I want to categorize items as "Inventory"
  or "Service/Non-Inventory", so that stock tracking is only applied to physical goods._
- **US-INVT-02:** _As an Operations Coordinator (Daniel), I want to log stock movements (Receipts,
  Transfers, Adjustments, Sales Fulfillments) across multiple locations, so that stock counts are
  accurate in real time._
- **US-INVT-03:** _As an Owner-Operator (Amina), I want to set minimum reorder thresholds for items
  and receive low-stock alerts, so that we never run out of critical sales inventory._
- **US-INVT-04:** _As a Finance Specialist (Ravi), I want inventory valuation calculated using FIFO
  or Moving Average costing, so that cost of goods sold (COGS) is accurately reflected in financial
  reports._
- **US-INVT-05:** _As an Operations Coordinator (Daniel), I want to reserve stock when a Sales Order
  is confirmed, so that inventory is allocated before final delivery._

#### 3. Acceptance Criteria

- **AC-INVT-01:** Product master enforces item type flag; service items bypass stock movement ledger
  entirely.
- **AC-INVT-02:** Stock movement entries post atomic transaction records (`stock_movement_ledger`)
  capturing source location, destination location, qty, timestamp, and user ID.
- **AC-INVT-03:** Automated notification engine dispatches daily low-stock digest to operations team
  when `availableStock <= reorderLevel`.
- **AC-INVT-04:** Valuation engine calculates unit cost based on selected method (FIFO queue or
  Moving Avg Formula) on each stock intake.
- **AC-INVT-05:** Sales Order confirmation creates `StockReservation` record, reducing
  `availableQuantity` while leaving `onHandQuantity` unchanged until Delivery Note.

#### 4. Priority Classification

**Phase 5 Must-Have**.

#### 5. Dependencies

Product Catalog, Procurement Module, Invoices Module.

#### 6. Success Metrics

99.5% accuracy between physical stock audits and system inventory balances.

---

### 6.8 Feature Area 8: CRM & Lead Management

#### 1. Description & Business Value

The CRM module organizes prospective sales opportunities from initial lead capture to pipeline
qualification, interaction logging, and one-click quote generation.

#### 2. User Stories

- **US-CRM-01:** _As an Operations Coordinator (Daniel), I want to capture incoming leads from web
  forms or manual entry into a structured Lead Pipeline, so that sales follow-ups are tracked._
- **US-CRM-02:** _As an Owner-Operator (Amina), I want to view a visual Kanban board of
  Opportunities by stage (Lead, Contacted, Proposal Sent, Negotiation, Closed Won, Closed Lost), so
  that I can forecast revenue._
- **US-CRM-03:** _As an Operations Coordinator (Daniel), I want to log call notes, emails, and
  meetings directly on a customer's timeline, so that any team member has full context on customer
  interactions._
- **US-CRM-04:** _As an Operations Coordinator (Daniel), I want to convert a "Closed Won"
  opportunity directly into a bizOS Quotation or Customer record, so that duplicate data entry is
  eliminated._
- **US-CRM-05:** _As an Owner-Operator (Amina), I want to track lead source performance and deal win
  rates, so that we can invest in effective marketing channels._

#### 3. Acceptance Criteria

- **AC-CRM-01:** Lead creation form validates contact details, checks for existing customer matches,
  and assigns lead stage `NEW`.
- **AC-CRM-02:** Kanban board permits drag-and-drop opportunity stage transition, recalculating
  stage total values and weighted pipeline value in real time.
- **AC-CRM-03:** Timeline view displays chronological feed of notes, tasks, quotation events, and
  emails linked to customer ID.
- **AC-CRM-04:** Opportunity conversion action creates Customer record and drafts Quotation with
  line items copied from opportunity scope.
- **AC-CRM-05:** CRM analytics dashboard displays win/loss ratios, average deal cycle length, and
  lead acquisition channel revenue.

#### 4. Priority Classification

**Phase 4 Must-Have**.

#### 5. Dependencies

Customer Directory, Quotations Module, Task Engine.

#### 6. Success Metrics

25% increase in lead-to-quotation conversion rate.

---

### 6.9 Feature Area 9: Projects & Work Execution

#### 1. Description & Business Value

The Projects module bridges commercial contracts and field execution, tracking project milestones,
deliverable sign-offs, time & cost logs, and milestone progress invoicing.

#### 2. User Stories

- **US-PROJ-01:** _As an Operations Coordinator (Daniel), I want to create a Project linked to an
  accepted Quotation or Sales Order, so that scope and budget are defined from the commercial
  contract._
- **US-PROJ-02:** _As an Operations Coordinator (Daniel), I want to define project milestones and
  deliverables with target due dates, so that progress can be monitored._
- **US-PROJ-03:** _As an Operations Coordinator (Daniel), I want team members to log billable and
  non-billable hours against project tasks, so that labor costs are tracked._
- **US-PROJ-04:** _As a Finance Specialist (Ravi), I want to generate a progress invoice based on
  completed project milestones, so that billing aligns with deliverable sign-offs._
- **US-PROJ-05:** _As an Owner-Operator (Amina), I want a project profitability dashboard showing
  quoted value, actual labor/expense costs, invoiced amount, and net margin, so that project health
  is clear._

#### 3. Acceptance Criteria

- **AC-PROJ-01:** Project initialization imports line items from Sales Order, establishing initial
  revenue budget and task breakdown.
- **AC-PROJ-02:** Milestone view tracks completion status (0-100%), requiring completion evidence
  attachment for milestone sign-off.
- **AC-PROJ-03:** Time tracking interface records start/end time or duration, activity type,
  billable status, and user hourly cost rate.
- **AC-PROJ-04:** Milestone invoicing action generates draft invoice pre-filled with milestone
  billing amount and attaches completion certificate PDF.
- **AC-PROJ-05:** Profitability widget updates margin calculation
  (`Margin = Invoiced - (Logged Labor Cost + Direct Expenses)`) continuously.

#### 4. Priority Classification

**Phase 4 Must-Have**.

#### 5. Dependencies

Quotations Module, Invoices Module, File Storage (R2).

#### 6. Success Metrics

100% of billable project hours captured and billed; project margin visibility.

---

### 6.10 Feature Area 10: Workflow Engine & Automations

#### 1. Description & Business Value

The Workflow Engine coordinates human decision gates, status transitions, condition checks, timers,
and background notifications, ensuring business logic is deterministic, auditable, and configurable
without code edits.

#### 2. User Stories

- **US-AUTO-01:** _As a System Admin, I want to define state machines and valid transitions for
  documents (e.g. Quotation states: Draft -> Pending Approval -> Approved -> Sent -> Accepted), so
  that illegal status jumps are prevented server-side._
- **US-AUTO-02:** _As an Operations Coordinator (Daniel), I want automated reminders sent to
  customers 3 days before an invoice due date and 7 days after overdue, so that manual follow-up
  effort is minimized._
- **US-AUTO-03:** _As a Business Admin, I want to configure approval guards (e.g. Require manager
  approval if Quote discount > 15%), so that business rules are enforced automatically._
- **US-AUTO-04:** _As an Operations Coordinator (Daniel), I want visual workflow rules triggered on
  events (e.g. When Invoice Paid -> Notify Project Lead -> Change Project Status to Active), so that
  cross-department hand-offs are automated._
- **US-AUTO-05:** _As a Finance Specialist (Ravi), I want all workflow state transitions recorded in
  an immutable audit trail with user ID, timestamp, and reason code, so that compliance auditing is
  effortless._

#### 3. Acceptance Criteria

- **AC-AUTO-01:** Workflow transition API checks active template version rules; unauthorized
  transition attempts return HTTP 422 Unprocessable Entity.
- **AC-AUTO-02:** Scheduler engine evaluates overdue triggers hourly, queuing templated notification
  outbox messages with idempotency checks.
- **AC-AUTO-03:** Readiness rules evaluate boolean formula ASTs deterministically without calling
  external unvetted scripts or arbitrary code execution.
- **AC-AUTO-04:** Visual event-action automation builder creates declarative JSON rule definitions
  executed via BullMQ background queues.
- **AC-AUTO-05:** Every state change inserts a row in `workflow_audit_log` with before/after state,
  actor ID, client IP, and transition payload.

#### 4. Priority Classification

**Phase 0/1 Core Engine: Must-Have; Phase 3 Visual Rule Builder: Must-Have**.

#### 5. Dependencies

NestJS Backend, PostgreSQL Database, BullMQ Queue.

#### 6. Success Metrics

Zero illegal workflow transitions committed; 99.9% on-time execution of scheduled automation pings.

---

### 6.11 Feature Area 11: AI Operating Layer

#### 1. Description & Business Value

The AI Operating Layer adds permission-filtered natural language reporting, PDF OCR document
extraction, draft response generation, and anomaly detection under strict RBAC and human
confirmation bounds.

#### 2. User Stories

- **US-AI-01:** _As an Owner-Operator (Amina), I want to ask natural language questions (e.g., "What
  are my top 3 overdue invoices this week?"), so that I get instant actionable summaries without
  building custom reports._
- **US-AI-02:** _As an Operations Coordinator (Daniel), I want to upload a PDF supplier bill and
  have AI extract vendor name, invoice date, line items, and tax totals into a draft bill, so that
  data entry time is reduced by 80%._
- **US-AI-03:** _As an Operations Coordinator (Daniel), I want AI to generate draft follow-up emails
  for overdue quotes or invoices tailored to customer history, so that I can send polite reminders
  in seconds._
- **US-AI-04:** _As a Finance Specialist (Ravi), I want AI anomaly detection to flag suspicious
  transactions (e.g., duplicate bill numbers, unusual bank accounts, rate spikes), so that fraud and
  errors are caught early._
- **US-AI-05:** _As an Agent Operator, I want AI agents to execute routine tasks (e.g., draft
  monthly statements) under strict budget limits and explicit preview/confirm gates, so that AI
  cannot make unapproved business changes._

#### 3. Acceptance Criteria

- **AC-AI-01:** Natural language RAG query engine injects active user tenant ID and Casbin role
  filters into vector/relational queries, preventing cross-tenant or unauthorized data leaks.
- **AC-AI-02:** Document OCR pipeline parses uploaded PDF/images, returning structured JSON with
  confidence scores per field; fields with <85% confidence are highlighted for human verification.
- **AC-AI-03:** Draft email generation presents an editable preview modal; email is never sent
  without explicit human click on "Approve & Send".
- **AC-AI-04:** Anomaly detection service scans incoming transactions asynchronously, generating
  warning alerts for matching pattern triggers (e.g. duplicate reference numbers).
- **AC-AI-05:** Agent execution framework logs total LLM token usage and enforces financial
  confirmation guards; any state mutation action requires interactive user sign-off.

#### 4. Priority Classification

**Phase 6 Must-Have**.

#### 5. Dependencies

Vector Search Infrastructure, Audit Engine, S3/R2 Storage, Casbin Filters.

#### 6. Success Metrics

80% reduction in manual data entry time for uploaded documents; 100% human confirmation compliance.

---

### 6.12 Feature Area 12: System Admin Portal & Configuration Engine

#### 1. Description & Business Value

The System Admin Portal provides platform engineering and support teams with dedicated multi-tenant
governance, versioned configuration template management, custom field definitions, and system health
monitoring.

#### 2. User Stories

- **US-SYS-01:** _As a System Admin, I want to create, version, and publish Workflow and
  Configuration Templates, so that new business setups can adopt standard or specialized ERP
  workflows safely._
- **US-SYS-02:** _As a System Admin, I want to inspect organization health, tenant storage usage,
  active configuration versions, and email delivery failures across the platform, so that operations
  remain stable._
- **US-SYS-03:** _As a System Admin, I want to configure structural Custom Fields (type, placement,
  validation, visibility) for an organization without code deployments, so that custom business
  requirements are met._
- **US-SYS-04:** _As a System Admin, I want to initiate time-limited, fully audited support
  impersonation of a tenant workspace, so that customer issues can be diagnosed safely with explicit
  consent._
- **US-SYS-05:** _As a System Admin, I want to preview configuration migration impact before
  assigning a new template version to a business, so that production business data is never
  corrupted._

#### 3. Acceptance Criteria

- **AC-SYS-01:** System Admin portal operates under separate platform-level authorization
  (`IS_SYSTEM_ADMIN`), completely distinct from business organization roles.
- **AC-SYS-02:** Platform dashboard renders real-time metrics for tenant counts, active
  configurations, R2 storage usage, email bounce rates, and background queue health.
- **AC-SYS-03:** Custom field definition engine writes declarative schema records; web UI
  dynamically renders custom inputs with client/server Zod schema validation.
- **AC-SYS-04:** Support impersonation creates temporary session token expiring in max 60 minutes,
  recording explicit audit event in `system_admin_audit_log` with ticket reference.
- **AC-SYS-05:** Migration preview tool compares current business record fields against target
  configuration template version, outputting potential schema conflicts or required default values.

#### 4. Priority Classification

**Must-Have** (Core Platform Portal; shipped and verified).

#### 5. Dependencies

Platform Auth Layer, Versioned Configuration Engine, Audit Logging Framework.

#### 6. Success Metrics

Zero unauthorized System Admin actions; configuration template assignment $< 5$ minutes.

---

### 6.13 Feature Area 13: Authentication & Role-Based Access Control (Auth/RBAC)

#### 1. Description & Business Value

Auth & RBAC governs user authentication, multi-tenant organization switching, invitation flows, and
granular Casbin role permissions (`OWNER`, `ADMIN`, `MEMBER`, `ACCOUNTANT`, `AUDITOR`).

#### 2. User Stories

- **US-AUTH-01:** _As a User, I want to register and log in securely using email/password or OAuth
  (Google/OIDC), so that my account identity is verified._
- **US-AUTH-02:** _As a Multi-Business User, I want to seamlessly switch between multiple business
  organizations from a top header menu, so that I can manage several companies under one login._
- **US-AUTH-03:** _As an Owner-Operator (Amina), I want to invite team members to my business and
  assign specific roles (e.g. Finance Specialist, Operations Coordinator), so that users only access
  what their job requires._
- **US-AUTH-04:** _As a Finance Specialist (Ravi), I want sensitive financial reports and bank
  details restricted from general operations staff, so that financial confidentiality is preserved._
- **US-AUTH-05:** _As a System Admin, I want session tokens (JWT) to enforce tenant ID context on
  every API request, so that unauthorized cross-tenant requests are blocked at the middleware
  gateway._

#### 3. Acceptance Criteria

- **AC-AUTH-01:** NextAuth handles authentication, issuing HTTP-only secure cookies with CSRF
  protection and Argon2 password hashing.
- **AC-AUTH-02:** Organization switcher updates active tenant context header (`X-Tenant-Id`),
  re-evaluating session permissions without full page reload.
- **AC-AUTH-03:** User invitation generates secure tokenized email link; invitee registration
  automatically attaches user to organization with specified Casbin role.
- **AC-AUTH-04:** Casbin authorization middleware evaluates `(user, tenant, resource, action)` tuple
  on every NestJS endpoint, returning HTTP 403 Forbidden on authorization failure.
- **AC-AUTH-05:** JWT payload embeds active tenant ID and permissions hash; request middleware
  verifies payload signature and tenant match on all API routes.

#### 4. Priority Classification

**Must-Have** (Core Baseline requirement; shipped and verified).

#### 5. Dependencies

NextAuth, Casbin Authorization Package, NestJS Guard Middleware.

#### 6. Success Metrics

Zero authentication bypass or privilege escalation vulnerabilities.

---

### 6.14 Feature Area 14: Multi-Tenancy & Business Isolation

#### 1. Description & Business Value

The Multi-Tenancy architecture guarantees strict database, configuration, and object storage
boundary isolation across all businesses sharing the bizOS platform.

#### 2. User Stories

- **US-TEN-01:** _As a Business Owner, I want strict multi-tenancy isolation enforced across all
  system data, so that my business data (customers, quotes, invoices, financial records) is strictly
  invisible to any other business on the platform._
- **US-TEN-02:** _As a System Architect, I want database queries to enforce tenant ID filters
  automatically at the Prisma ORM / database level, so that developers cannot accidentally omit
  tenant filters._
- **US-TEN-03:** _As an Operations Coordinator (Daniel), I want object storage files (PDFs, PO
  attachments) stored in private R2 paths scoped by tenant ID, so that document URLs cannot be
  enumerated or accessed across tenants._
- **US-TEN-04:** _As a System Admin, I want to view resource consumption (database rows, storage MB,
  API requests) broken down by tenant ID, so that noisy neighbor behavior or limit breaches are
  managed._
- **US-TEN-05:** _As a Developer, I want automated integration tests to attempt cross-tenant data
  access on every build, so that any tenancy regression instantly breaks CI._

#### 3. Acceptance Criteria

- **AC-TEN-01:** Every database entity table contains `tenantId String` column with indexed foreign
  key constraints and mandatory tenant scoping.
- **AC-TEN-02:** Database service `DatabaseService.withScope()` executes `SET LOCAL app.tenant_id`
  and `SET LOCAL app.business_id` before Prisma queries, enforcing PostgreSQL `FORCE RLS`.
- **AC-TEN-03:** S3/R2 storage keys follow pattern `tenants/{tenantId}/{documentType}/{fileId}.pdf`;
  API generates short-lived pre-signed URLs (15 min exp) with tenant authorization check.
- **AC-TEN-04:** System Admin metrics collector aggregates database row counts and object storage
  bytes per tenant ID daily.
- **AC-TEN-05:** Automated Playwright test suite executes cross-tenant access assertions (User A
  requesting Tenant B resource ID), verifying HTTP 404/403 response on 100% of routes.

#### 4. Priority Classification

**Must-Have** (Core Baseline requirement; shipped and verified).

#### 5. Dependencies

PostgreSQL RLS Engine, Prisma ORM Middleware, S3/R2 Storage Package.

#### 6. Success Metrics

Zero confirmed cross-tenant data leaks; 100% test pass on automated cross-tenant security suite in
CI.

---

### 6.15 Feature Area 15: Compliance, Internationalization & Tax Engine

#### 1. Description & Business Value

The Compliance & Tax Engine provides country compliance packages (Saudi Arabia ZATCA Phase 1 & 2,
UAE EmaraTax, India GST), bilingual RTL/LTR multi-language support (Arabic/English), and
deterministic tax calculations.

#### 2. User Stories

- **US-TAX-01:** _As a Finance Specialist (Ravi) in Saudi Arabia, I want the tax engine to apply the
  standard 15% VAT rate, render Arabic VAT descriptions, and output ZATCA Phase 1 compliant QR codes
  on all invoices, so that invoices fully comply with Saudi tax authority regulations._
- **US-TAX-02:** _As an Owner-Operator (Amina) in the UAE, I want invoices rendered in AED currency
  with explicit TRN (Tax Registration Number) handling and line-level rounding, so that our billing
  complies with UAE FTA regulations._
- **US-TAX-03:** _As a Finance Specialist (Ravi) in India, I want state-aware GST calculation
  (CGST + SGST for intra-state sales, IGST for inter-state sales) based on customer state code and
  GSTIN, so that Indian tax obligations are computed accurately._
- **US-TAX-04:** _As an Arabic-speaking User, I want to switch the bizOS web application UI layout
  to Modern Standard Arabic with full Right-to-Left (RTL) mirroring, so that native business
  workflows are comfortable._
- **US-TAX-05:** _As a Finance Specialist (Ravi), I want tax rule packages to be versioned and
  effective-dated, so that historical tax invoices retain the tax rate in effect at issuance even if
  tax laws change later._

#### 3. Acceptance Criteria

- **AC-TAX-01:** Saudi tax package applies 15% VAT rate, formats Arabic monetary strings, and
  includes ZATCA Phase 1 TLV QR tag structure (Seller Name, VAT #, Timestamp, Total, Tax Total).
- **AC-TAX-02:** UAE tax package handles 5% VAT rate, AED currency minor units, TRN formatting
  validation, and line rounding rules per FTA guide.
- **AC-TAX-03:** India tax package compares seller state code vs customer state code: matching state
  splits tax into CGST (50%) + SGST (50%); differing state applies IGST (100%).
- **AC-TAX-04:** Next.js i18n framework supports `ar` locale setting `dir="rtl"` on `<html>`,
  applying Tailwind RTL layout utilities and Arabic typography correctly.
- **AC-TAX-05:** Tax Engine loads rule package matching document `issueDate`; updates to tax rates
  insert new versioned rule package without modifying past issued document records.

#### 4. Priority Classification

**Phase 1 / Phase 2 Must-Have** (ZATCA Phase 1 QR: Shipped; ZATCA Phase 2 clearance & full RTL:
Phase 1/2).

#### 5. Dependencies

NestJS Tax Engine Service, Next.js i18n Framework, ZATCA TLV Encoder, Chromium PDF Renderer.

#### 6. Success Metrics

100% calculation accuracy against official tax authority test vectors; zero layout breakdown between
Arabic (RTL) and English (LTR).

---

## 7. Summary Matrix of User Stories & Acceptance Criteria

Below is the master summary matrix of all 75 User Stories across the 15 feature areas:

| Area # | Feature Area                  | Story Range       | Acceptance Criteria Range | Primary Personas                        | Roadmap Phase                  |
| ------ | ----------------------------- | ----------------- | ------------------------- | --------------------------------------- | ------------------------------ |
| 1      | Quotations                    | US-QUOTE-01 to 05 | AC-QUOTE-01 to 05         | Amina, Daniel, Noor, Ravi, Customer     | Phase 0 (Shipped)              |
| 2      | Invoices & Billing            | US-INV-01 to 05   | AC-INV-01 to 05           | Daniel, Ravi, Amina, Customer           | Phase 0 (Shipped)              |
| 3      | Payments & Collections        | US-PAY-01 to 05   | AC-PAY-01 to 05           | Daniel, Ravi, Amina, Customer           | Phase 0 (Core) / Phase 2       |
| 4      | Account Statements            | US-STMT-01 to 05  | AC-STMT-01 to 05          | Ravi, Daniel, Amina, Customer           | Phase 0 (Core) / Phase 2       |
| 5      | Credit Notes & Adjustments    | US-CN-01 to 05    | AC-CN-01 to 05            | Ravi, Daniel, Amina, Noor               | Phase 2                        |
| 6      | Suppliers & Procurement       | US-SUPP-01 to 05  | AC-SUPP-01 to 05          | Daniel, Ravi, Amina                     | Phase 1 / Phase 2              |
| 7      | Inventory Management          | US-INVT-01 to 05  | AC-INVT-01 to 05          | Daniel, Amina, Ravi                     | Phase 5                        |
| 8      | CRM & Lead Management         | US-CRM-01 to 05   | AC-CRM-01 to 05           | Daniel, Amina                           | Phase 4                        |
| 9      | Projects & Work Execution     | US-PROJ-01 to 05  | AC-PROJ-01 to 05          | Daniel, Ravi, Amina                     | Phase 4                        |
| 10     | Workflow Engine & Automations | US-AUTO-01 to 05  | AC-AUTO-01 to 05          | System Admin, Daniel, Ravi              | Phase 0 (Engine) / Phase 3     |
| 11     | AI Operating Layer            | US-AI-01 to 05    | AC-AI-01 to 05            | Amina, Daniel, Ravi, Agent Operator     | Phase 6                        |
| 12     | System Admin Portal           | US-SYS-01 to 05   | AC-SYS-01 to 05           | System Admin                            | Phase 0 (Shipped)              |
| 13     | Auth & RBAC                   | US-AUTH-01 to 05  | AC-AUTH-01 to 05          | All Users, Owner, Finance, System Admin | Phase 0 (Shipped)              |
| 14     | Multi-Tenancy & Isolation     | US-TEN-01 to 05   | AC-TEN-01 to 05           | Owner, Architect, Operations, Admin     | Phase 0 (Shipped)              |
| 15     | Compliance & Tax Engine       | US-TAX-01 to 05   | AC-TAX-01 to 05           | Ravi, Amina, Arabic User                | Phase 0 (Phase 1 QR) / Phase 1 |

---

## 8. Current-State Gap Analysis Matrix

This matrix maps shipped production capabilities against unbuilt roadmap features, explicitly
referencing codebase directories:

| Feature / Domain            | Roadmap Phase | Build Status        | Codebase Artifacts Shipped                                                    | Unbuilt Delta (Roadmap Gap)                                           |
| --------------------------- | ------------- | ------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **Auth & Security**         | Phase 0       | **Shipped**         | `apps/api/src/identity/`, `apps/api/src/security/`, `packages/authorization/` | OAuth2 social providers (Google/OIDC), SAML enterprise SSO.           |
| **Business & Settings**     | Phase 0       | **Shipped**         | `apps/api/src/platform/`, `packages/database/prisma/schema.prisma`            | Multi-currency exchange rate feeds, branch hierarchy.                 |
| **Customer Directory**      | Phase 0 / 1   | **Shipped**         | `apps/api/src/customers/`, `apps/web/src/app/b/[businessId]/customers/`       | Customer self-service portal login, credit limit rules.               |
| **Quotations**              | Phase 0       | **Shipped**         | `apps/api/src/documents/quotations.controller.ts`, `quotations.service.ts`    | Multi-option quote proposals, customer online signature.              |
| **Customer PO Intake**      | Phase 0       | **Shipped**         | `apps/api/src/purchase-orders/`, `packages/storage/`                          | Automated OCR parsing of incoming customer PO PDFs.                   |
| **Invoices & Conversion**   | Phase 0       | **Shipped**         | `apps/api/src/documents/invoices.controller.ts`, `invoices.service.ts`        | Subscription recurring billing, partial quote line conversion.        |
| **Payments (Offline)**      | Phase 0       | **Shipped**         | `apps/api/src/payments/`, `apps/web/src/app/b/[businessId]/payments/`         | Payment Gateway online links (Stripe/Moyasar), bank feeds.            |
| **Account Statements**      | Phase 0       | **Shipped**         | `apps/api/src/statements/`, `apps/web/src/app/b/[businessId]/statements/`     | Persistent statement snapshot records, monthly auto-send.             |
| **Configuration Backbone**  | Phase 0       | **Shipped**         | `apps/api/src/configuration/`, `packages/database/prisma/seeds/`              | Visual drag-and-drop workflow builder in Admin portal.                |
| **Guided Onboarding**       | Phase 0       | **Shipped**         | `apps/api/src/onboarding/`, `apps/web/src/app/start/`                         | Branching questions for enterprise multi-entity businesses.           |
| **System Admin Portal**     | Phase 0       | **Shipped**         | `apps/api/src/system-admin/`, `apps/web/src/app/admin/`                       | Automated tenant billing limit enforcement & self-suspension.         |
| **ZATCA E-Invoicing**       | Phase 0 / 2   | **Partially Built** | `packages/contracts/src/zatca.ts` (Phase 1 Base64 TLV generator shipped)      | ZATCA Phase 2 Fatoora API integration (ECDSA XML signing, clearance). |
| **Suppliers & Procurement** | Phase 1 / 2   | **Unbuilt**         | `ModuleDefinition` seed (`supplier-purchases`, `implemented=false`)           | Supplier master table, Supplier POs, Bills, GRN, 3-way match.         |
| **Inventory & Stock**       | Phase 5       | **Unbuilt**         | `ModuleDefinition` seed (`inventory`, `implemented=false`)                    | Items master, Warehouse locations, Stock movements, FIFO/AVCO.        |
| **Sales Orders & Delivery** | Phase 1       | **Unbuilt**         | `ModuleDefinition` seed (`sales-orders`, `implemented=false`)                 | Sales Order entity, Delivery Notes, Service Certificates.             |
| **Credit Notes**            | Phase 2       | **Unbuilt**         | `ModuleDefinition` seed (`credit-notes`, `implemented=false`)                 | Credit Note entity, Debit Notes, Tax adjustment accounting.           |
| **CRM & Leads**             | Phase 4       | **Unbuilt**         | Seeded in roadmap specs                                                       | Lead entity, Opportunity Kanban, Deal pipeline tracking.              |
| **Projects & Time**         | Phase 4       | **Unbuilt**         | `projectReference` string field on `Document` and `PurchaseOrder`             | Project entity, Milestones, Time log tracking, Billing rules.         |
| **AI Operating Layer**      | Phase 6       | **Unbuilt**         | `CustomizationRequest` n8n notifier webhook (`n8n-notifier.ts`)               | Governed RAG search, PDF OCR extraction, Copilot assistant.           |

---

## 9. Architecture, Systems & Platform Design

### 9.1 Information Architecture & Navigation Model

bizOS organizes its user interface around human work responsibilities rather than raw database
modules:

```text
Global Navigation Rail (Desktop) / Navigation Bar (Mobile):
├── 1. Today       --> Action items, expiring quotes, overdue payments, cash snapshot
├── 2. Work        --> Offers (Quotes), Orders, Approvals, Invoices, Payments, Statements
├── 3. Contacts    --> Customers, Suppliers, People & Addresses
├── 4. Reports     --> Operational insights, VAT/GST summaries, cash flow forecasts
├── 5. Automations --> Active rules, runs, dead-letter items, approval queue
└── 6. Settings    --> Business profile, Team Roles, Document Templates, Tax, Packs
```

- **Active Workspace Context Switcher:** Header selector for switching active business workspace.
  Switching updates context header (`X-Business-Id`), resets active cache, and re-evaluates Casbin
  permissions independently.
- **Object Page Blueprint:** Header Banner (Summary & State) $\rightarrow$ Recommended Next Action
  Button $\rightarrow$ Primary Facts $\rightarrow$ Activity Timeline $\rightarrow$ Related Documents
  $\rightarrow$ Audit Details (Progressive Disclosure).

### 9.2 Data Model & Entity Relationships

The core data model organizes 32 domain models in `packages/database/prisma/schema.prisma` across
six primary logical boundaries:

1. **Tenant & Identity Boundary:** `Tenant` $\rightarrow$ `Business` $\rightarrow$ `User`
   $\rightarrow$ `Membership` $\rightarrow$ `Role` $\rightarrow$ `BusinessAccess` $\rightarrow$
   `PlatformSystemAdmin`.
2. **Commercial Documents Boundary:** `Customer` $\rightarrow$ `Document` (Quotation & Invoice)
   $\rightarrow$ `DocumentLine` $\rightarrow$ `DocumentVersion` $\rightarrow$ `DocumentDelivery`.
3. **PO & Evidence Boundary:** `PurchaseOrder` $\rightarrow$ `StoredObject` (R2 stored files: PO
   PDF, Approval Evidence).
4. **Payments Boundary:** `Payment` $\rightarrow$ `PaymentAllocation` (linked to `Document`).
5. **Configuration & Governance Boundary:** `ModuleDefinition`, `ConfigurationTemplate`,
   `ConfigurationTemplateVersion`, `WorkflowTemplate`, `WorkflowTemplateVersion`,
   `BusinessConfigurationAssignment`, `DocumentWorkflowContext`, `CustomFieldDefinition`,
   `IndustryPack`, `FeatureFlag`, `AuditEvent`, `ConfigurationAuditEvent`, `CustomizationRequest`,
   `OutboxEvent`.
6. **System Configuration & Tax Engine:** `BusinessSettings`, `TaxProfile`.

### 9.3 Versioned Deterministic Workflow Engine & State Machines

- **Engine Design (ADR-0006):** Workflow definitions are versioned, immutable JSON structures
  (`WorkflowTemplateVersion`). Transitions are executed by loading state, validating Zod input,
  evaluating deterministic JSON AST guards (`GuardInterpreter`), updating DB state, inserting an
  audit entry, and dispatching outbox events in a single PostgreSQL transaction.
- **Outbox Pattern (ADR-0010):** Asynchronous side-effects (SMTP email, webhook dispatches,
  background jobs) write to `OutboxEvent` in the same transaction. A BullMQ worker polls outbox
  events and executes jobs with at-least-once retry semantics.

### 9.4 Authorization Model & Casbin RBAC

- **Policy Model (ADR-0007):** Evaluates `p = sub, dom, obj, act` where `dom` =
  `tenantPublicId:businessPublicId`.
- **Role Hierarchy:**
  - `OWNER`: Full administrative, user management, and financial governance authority.
  - `ADMIN`: Operational administration, workflow management, PO approval updates.
  - `MEMBER`: Work execution, quote drafting, customer creation.
  - `ACCOUNTANT`: Read-only financial statements, tax return review, audit exports.
  - `AUDITOR`: Read-only time-bounded access to transaction and audit logs.

### 9.5 Multi-Tenancy & Business Isolation Model

- **Database RLS (ADR-0004):** Every business table contains mandatory `tenant_id` and `business_id`
  columns with indexed constraints. PostgreSQL `FORCE RLS` policies block queries that do not match
  active GUC variables set via `DatabaseService.withScope()`.
- **Private Object Storage (ADR-0017):** S3/R2 keys enforce strict scoping:
  `tenants/{tenantId}/{documentType}/{fileId}.pdf`. Pre-signed URLs expire after 15 minutes and
  require valid session authorization checks.

### 9.6 Internationalization (i18n), Localization (l18n) & Arabic RTL Strategy

- **Launch Locales:** English (`en`) default across all markets; Modern Standard Arabic (`ar`) for
  Saudi Arabia and UAE.
- **Arabic PDF Rendering Strategy (ADR-0013 / Document Templates Plan):** Standard PDFKit font
  engines corrupt Arabic glyph joining and reverse numeric runs (e.g. rendering address digits
  `١٢٢١١` backwards as `١١٢١١`). bizOS uses **Headless Chromium (`page.pdf()`)** rendering to
  produce 100% compliant Arabic/English bilingual PDF invoices and ZATCA Phase 1 QR codes.

### 9.7 Country Compliance & Tax Engine Architecture

- **Saudi Arabia (ZATCA):** 15% VAT, Arabic Tax Invoices, Commercial Registration (C.R.) number,
  ZATCA Phase 1 Base64 TLV QR code (`packages/contracts/src/zatca.ts`), and ZATCA Phase 2 Fatoora
  API clearance integration.
- **United Arab Emirates (FTA):** 5% VAT, Tax Registration Number (TRN), AED line-level rounding
  rules, Tax Invoices.
- **India (GST Portal):** State-aware GST (CGST + SGST for intra-state, IGST for inter-state) based
  on state codes and GSTIN.
- **Tax Calculation Pipeline:** Money inputs in minor units $\rightarrow$ TaxProfile rate PPM
  $\rightarrow$ Line Subtotal $\rightarrow$ `subtotalMinor * taxRatePpm / 1,000,000` $\rightarrow$
  Deterministic minor unit residual distribution.

### 9.8 Monetization & Pricing Strategy

- **Pricing Model:** Charged per **Business** per month (not per user seat), supporting
  multi-company owners:
  - **Starter Plan (SAR 79/mo / AED 79/mo / INR 699/mo):** 1 business, 2 users, up to 100
    documents/mo, quotations, invoices, payments, statements.
  - **Growth Plan (SAR 169/mo / AED 149/mo / INR 1,499/mo):** 5 users, up to 500 documents/mo,
    customer POs, approval evidence, ZATCA Phase 2.
  - **Pro Plan (SAR 349/mo / AED 299/mo / INR 2,999/mo):** 10 users, up to 2,000 documents/mo,
    multi-business administration, custom workflows.
- **Metred Feature Credits:** Credits apply exclusively to high-cost optional features (AI OCR
  extraction, WhatsApp pings, high-volume automated reminders). Credits are NEVER required for core
  accounting access or legal compliance.
- **Complimentary Grants:** System Admins can issue audited, time-bounded complimentary grants or
  discounts that auto-expire unless renewed.

### 9.9 Integration & Developer API Strategy

- **REST & OpenAPI (ADR-0011):** Resource-oriented REST APIs documented with OpenAPI 3.0, returning
  RFC 9457 Problem Details (`application/problem+json`) on errors.
- **Idempotency & Webhooks:** State-changing endpoints support `Idempotency-Key` headers. Webhook
  events emit signed HMAC signatures (`X-BizOS-Signature: t=timestamp,v1=hash`) with at-least-once
  delivery retry policies.

### 9.10 Mobile & Multi-Platform Strategy

- **Responsive Web UI:** Built with Tailwind CSS and Next.js, supporting touch target sizes
  $\ge 44 \times 44\text{px}$ and WCAG 2.2 AA contrast standards across iOS and Android browsers.
- **PWA Capabilities:** Service worker caching for offline draft entry, syncing when network
  connectivity is restored.

### 9.11 AI & Automation Roadmap

- **Governed Extensions & AI (ADR-0012):** AI assistants operate under strict capability manifests.
  Natural language RAG retrieval filters vector results using active Casbin tenant permissions.
- **Human Confirmation Gate:** 100% of autonomous state mutations (creating invoices, issuing
  refunds, sending emails) require explicit human click sign-off in an interactive modal.

---

## 10. Governance, Success Metrics, Risks & Assumptions

### 10.1 Phase Success Metrics & KPIs Table

| Roadmap Phase                      | Core Success Metric / Target KPI                                               | Verification Method                                 |
| ---------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------- |
| **Phase 0: ERP Foundation**        | Time-to-first-invoice $< 5$ minutes; 0 cross-tenant data leaks.                | End-to-end integration tests & Playwright suite.    |
| **Phase 1: MVP & Document Core**   | 99.9% PDF render success rate; gapless sequential numbering.                   | Production telemetry & atomic lock stress test.     |
| **Phase 2: Payments & Statements** | 100% reconciliation accuracy between payments & invoice ledger.                | Automated financial audit test suite.               |
| **Phase 3: APIs & Automations**    | Webhook delivery SLA $> 99.9\%$; 0 unhandled webhook retries.                  | Webhook queue metrics & HMAC signature checks.      |
| **Phase 4: CRM & Projects**        | 25% increase in quote conversion; 100% billable hour capture.                  | Operational reporting analytics.                    |
| **Phase 5: Inventory & Ecosystem** | $99.5\%$ physical stock audit accuracy; 0 cross-tenant plugin leaks.           | Stock movement ledger audit & runtime sandbox test. |
| **Phase 6: AI Operating Layer**    | 80% reduction in manual data entry time; 100% human click sign-off compliance. | Audit event logs & AI interaction telemetry.        |

### 10.2 Sequencing Constraints & Dependency Graph (DAG)

The roadmap phases form a strict Directed Acyclic Graph (DAG):

$$\text{Phase 0 (ERP Foundation)} \longrightarrow \text{Phase 1 (MVP Core)} \longrightarrow \text{Phase 2 (Payments \& Statements)}$$
$$\text{Phase 2} \longrightarrow \text{Phase 3 (APIs \& Automations)} \longrightarrow \text{Phase 4 (CRM \& Projects)}$$
$$\text{Phase 4} \longrightarrow \text{Phase 5 (Inventory \& Extensions)} \longrightarrow \text{Phase 6 (AI Operating Layer)}$$

_Rule:_ No phase may enter production until all preceding phase exit criteria are satisfied and
verified by automated CI test suites.

### 10.3 Risks, Mitigation Strategies & Assumptions

1. **Risk: Free-Tier Infrastructure Cold Starts & Resource Limits.**
   - _Mitigation:_ Demand-driven keep-warm worker
     (`docs/journal/2026-08-06-render-cold-start-and-opennext-spike.md`) caps monthly Render usage
     at 690 hours (under 750h grant). Web tier split to Cloudflare Workers via OpenNext (ADR-0022).
2. **Risk: Arabic PDF Layout & Glyph Corruption.**
   - _Mitigation:_ Adopted Headless Chromium PDF rendering (`page.pdf()`) over PDFKit, guaranteeing
     100% correct Arabic text shaping, right-to-left layout, and ZATCA QR codes.
3. **Risk: Multi-Tenant Data Leakage via Developer Error.**
   - _Mitigation:_ Database-level `FORCE RLS` using GUC variables (`app.tenant_id`,
     `app.business_id`) in `DatabaseService.withScope()`. CI runs automated cross-tenant security
     assertions on every pull request.
4. **Risk: Accounting Jargon Obscuring User Experience.**
   - _Mitigation:_ Plain-language UI policy; formal accounting terms exposed only to authorized
     `ACCOUNTANT` role views.
5. **Assumption: $0 Budget Constraint.**
   - _Assumption:_ Platform operations remain strictly within free-tier grants unless formal
     commercial revenue justifies infrastructure upgrades.

---
