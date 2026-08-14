# Test Infrastructure Specification: bizOS Monorepo

## 1. Executive Summary & Testing Philosophy

bizOS requires an authoritative, requirement-driven, opaque-box test suite across all monorepo
workspaces (`apps/api`, `apps/web`, and `packages/*`). The testing strategy validates feature
compliance against user stories and specifications in `docs/prd.md` and `PROJECT.md`, without
coupling to internal private implementations or introducing external paid service dependencies ($0
budget constraint).

---

## 2. Testing Tiers & Coverage Strategy

The test architecture is structured around four distinct testing tiers:

| Tier       | Category                   | Minimum Target        | Description                                                                                                                          |
| ---------- | -------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Tier 1** | Feature Coverage           | 225 cases (5/feature) | Core happy paths, status transitions, schema contracts, and domain business rules for FEAT-01 through FEAT-45.                       |
| **Tier 2** | Boundary & Corner Cases    | 225 cases (5/feature) | Negative validation, limit conditions, invalid inputs, authorization bypass attempts, tenant leakage checks, and edge calculations.  |
| **Tier 3** | Cross-Feature Interactions | 45 cases              | Pairwise interactions between features across module boundaries (e.g. Auth ↔ Switcher, Quote ↔ Invoice, PO ↔ GRN ↔ Bill).            |
| **Tier 4** | Real-World Workloads       | 23 cases              | End-to-end multi-tenant commercial operations, high-concurrency simulation, end-to-end order-to-cash, and procure-to-pay lifecycles. |

**Total Monorepo Target**: 518+ Test Cases across all 45 Features (FEAT-01 through FEAT-45).

---

## 3. Monorepo Workspace Test Runner Commands

Tests execute via standard Vitest runners per package/app workspace:

```bash
# Authorization Package (Casbin RBAC)
pnpm --filter @bizo/authorization test

# Database Package (Prisma Schema, RLS Middleware, Seeds & Backfills)
pnpm --filter @bizo/database test

# Domain Contracts Package (Zod Contracts, ZATCA TLV/QR, Money Minor Arithmetic)
pnpm --filter @bizo/contracts test

# Queue Package (BullMQ Job Processor & Envelope Handlers)
pnpm --filter @bizo/queue test

# API Modular Monolith Backend
pnpm --filter @bizo/api exec vitest run

# Web App Tier
pnpm --filter @bizo/web exec vitest run
```

---

## 4. Feature Coverage Mapping Matrix (FEAT-01 through FEAT-45)

| Feature ID | Feature Name                   | PRD Reference   | Assigned Domain Group | Target Workspace                 |
| ---------- | ------------------------------ | --------------- | --------------------- | -------------------------------- |
| FEAT-01    | User Auth & Identity           | PRD §3.2, §6.13 | Group 1               | `apps/api`, `apps/web`           |
| FEAT-02    | Multi-Business Switcher        | PRD §6.13       | Group 1               | `apps/api`, `apps/web`           |
| FEAT-03    | Casbin RBAC Security           | PRD §3.5, §6.13 | Group 1               | `packages/authorization`         |
| FEAT-04    | PostgreSQL RLS Isolation       | PRD §3.5, §6.14 | Group 1               | `packages/database`              |
| FEAT-05    | Customer Directory             | PRD §3.2, §6.1  | Group 2               | `apps/api`, `apps/web`           |
| FEAT-06    | Quotation Builder              | PRD §3.2, §6.1  | Group 2               | `apps/api`, `apps/web`           |
| FEAT-07    | Customer PO Intake             | PRD §3.2, §6.1  | Group 2               | `apps/api`, `packages/storage`   |
| FEAT-08    | Discount Approval Guard        | PRD §3.5, §6.10 | Group 2               | `apps/api`                       |
| FEAT-09    | Public Quote Portal            | PRD §6.1        | Group 2               | `apps/web`, `apps/api`           |
| FEAT-10    | Gapless Invoice Conversion     | PRD §3.2, §6.2  | Group 2               | `apps/api`, `apps/web`           |
| FEAT-11    | Bilingual PDF & ZATCA QR       | PRD §3.5, §6.2  | Group 2               | `packages/contracts`, `apps/api` |
| FEAT-12    | SMTP Email Delivery            | PRD §3.2, §6.2  | Group 2               | `packages/queue`, `apps/api`     |
| FEAT-13    | Payment Recording              | PRD §3.2, §6.3  | Group 2               | `apps/api`, `apps/web`           |
| FEAT-14    | Payment Gateway Links          | PRD §6.3        | Group 2               | `apps/api`, `packages/queue`     |
| FEAT-15    | Overpayment Credits            | PRD §6.3        | Group 2               | `apps/api`                       |
| FEAT-16    | Statements & Aging             | PRD §3.2, §6.4  | Group 2               | `apps/api`, `apps/web`           |
| FEAT-17    | Scheduled Monthly Statements   | PRD §6.4        | Group 2               | `packages/queue`                 |
| FEAT-18    | Credit Notes & Adjustments     | PRD §6.5        | Group 2               | `apps/api`, `apps/web`           |
| FEAT-19    | Supplier Directory             | PRD §6.6        | Group 3               | `apps/api`, `apps/web`           |
| FEAT-20    | Outbound Supplier POs          | PRD §6.6        | Group 3               | `apps/api`                       |
| FEAT-21    | Supplier Bill 3-Way Match      | PRD §6.6        | Group 3               | `apps/api`                       |
| FEAT-22    | Goods Receipt Notes (GRN)      | PRD §6.6, §6.7  | Group 3               | `apps/api`                       |
| FEAT-23    | Inventory Item Catalog         | PRD §6.7        | Group 3               | `apps/api`, `packages/database`  |
| FEAT-24    | Stock Valuation Engine         | PRD §6.7        | Group 3               | `apps/api`                       |
| FEAT-25    | Low-Stock Digest               | PRD §6.7        | Group 3               | `apps/api`, `packages/queue`     |
| FEAT-26    | CRM Lead & Opportunity         | PRD §6.8        | Group 4               | `apps/api`, `apps/web`           |
| FEAT-27    | Customer Interaction Feed      | PRD §6.8        | Group 4               | `apps/api`, `apps/web`           |
| FEAT-28    | 1-Click Deal Conversion        | PRD §6.8        | Group 4               | `apps/api`                       |
| FEAT-29    | Projects & Milestones          | PRD §6.9        | Group 4               | `apps/api`, `apps/web`           |
| FEAT-30    | Time & Cost Logs               | PRD §6.9        | Group 4               | `apps/api`                       |
| FEAT-31    | Progress Invoicing             | PRD §6.9        | Group 4               | `apps/api`                       |
| FEAT-32    | Project Profitability          | PRD §6.9        | Group 4               | `apps/api`, `apps/web`           |
| FEAT-33    | Versioned State Machine        | PRD §3.5, §6.10 | Group 4               | `apps/api`                       |
| FEAT-34    | Visual Automation Builder      | PRD §6.10       | Group 4               | `apps/web`, `packages/queue`     |
| FEAT-35    | Workflow Audit Logging         | PRD §6.10       | Group 4               | `packages/database`, `apps/api`  |
| FEAT-36    | Permission-Filtered RAG Search | PRD §6.11       | Group 5               | `apps/api`, `apps/web`           |
| FEAT-37    | PDF/Receipt OCR Extraction     | PRD §6.11       | Group 5               | `apps/api`                       |
| FEAT-38    | Draft Email Generator          | PRD §6.11       | Group 5               | `apps/web`, `apps/api`           |
| FEAT-39    | Anomaly Detection              | PRD §6.11       | Group 5               | `apps/api`                       |
| FEAT-40    | System Admin Portal            | PRD §3.2, §6.12 | Group 1               | `apps/api`, `apps/web`           |
| FEAT-41    | Custom Fields Engine           | PRD §3.2, §6.12 | Group 1               | `apps/api`, `apps/web`           |
| FEAT-42    | Audited Impersonation          | PRD §6.12       | Group 1               | `apps/api`                       |
| FEAT-43    | Migration Diff Preview         | PRD §6.12       | Group 1               | `apps/api`                       |
| FEAT-44    | Internationalization & Arabic  | PRD §6.15       | Group 5               | `apps/web`                       |
| FEAT-45    | Multi-Country Tax Engine       | PRD §3.5, §6.15 | Group 5               | `apps/api`, `packages/contracts` |

---

## 5. Anti-Cheat & Quality Assurance Guidelines

1. **No Fabricated Outputs**: Test verification outputs, logs, and handoffs must strictly reflect
   test files present on disk and executed via Vitest.
2. **No Facade Mocks**: Test implementations must execute real domain schema parsing, AST guard
   logic, and mathematical operations.
3. **No Soft Assertion Bypasses**: Bypassing missing test files by claiming pass counts without
   writing source test files is strictly flagged as an Integrity Violation.
