# PRD implementation: Phase 1-5 feature build-out

Date: 2026-08-06

Agent: opencode-main

Scope: apps/api, apps/web, packages/contracts, packages/database

Status: In progress

Related: PRD `docs/prd.md`, `docs/product-requirements.md`, `docs/roadmap.md`

## Context

The PRD (`docs/prd.md`, version 5.0) defines 75 user stories across 15 feature areas spanning 7
roadmap phases. The repository shipped Phase 0 (quotation-to-invoice vertical slice, configuration
backbone, System Admin portal). This session implements the unbuilt Phases 1, 2, 4, and 5: Sales
Orders, Delivery Notes, Service Completion, Suppliers & Procurement, Credit Notes, CRM
(Leads/Opportunities), Projects, and Inventory.

Budget constraint: strictly $0 — no paid services, no external dependencies beyond the existing
open-source stack.

## What changed

### Database schema (`packages/database/prisma/schema.prisma`)

- Extended `DocumentType` enum: added `SALES_ORDER`, `DELIVERY_NOTE`, `SERVICE_COMPLETION`,
  `SUPPLIER_QUOTATION`, `SUPPLIER_PURCHASE_ORDER`, `SUPPLIER_BILL`, `GOODS_RECEIPT_NOTE`,
  `CREDIT_NOTE`, `DEBIT_NOTE`.
- Extended `StoredObjectKind` enum: added `SUPPLIER_PO`, `SUPPLIER_BILL`, `GOODS_RECEIPT`,
  `PROJECT_EVIDENCE`.
- Added `Supplier` model (vendor master data: tax ID, bank details, payment terms).
- Added `CreditNoteAllocation` model (credit note → invoice applications).
- Added `Lead` and `Opportunity` models (CRM pipeline).
- Added `Project` model (jobs, budgets, customer link).
- Added `InventoryItem` model (SKU, pricing, reorder levels).
- Extended `Document` with `supplierId`, `sourceDocumentId`, `referenceDocumentId`, `deliveryDate`,
  `receivedAt`.
- Extended `PurchaseOrder` with `supplierId`.
- Extended `BusinessSettings` with numbering prefixes/sequences for sales orders, delivery notes,
  credit notes, and purchase orders.
- Created migration `20260807000000_phase1_sales_procurement_crm/migration.sql`.

### Contracts (`packages/contracts/src/`)

New Zod schema files:

- `sales-orders.ts` — `SalesOrder`, create/update/send request schemas.
- `delivery-notes.ts` — `DeliveryNote`, create/update request schemas.
- `suppliers.ts` — `Supplier`, create/update request schemas.
- `credit-notes.ts` — `CreditNote`, reason enum, create/update request schemas.
- `crm.ts` — `Lead` (status enum), `Opportunity` (stage enum), request schemas.
- `projects.ts` — `Project` (status enum), request schemas.
- `inventory.ts` — `InventoryItem` (type enum), request schemas.
- Updated `package.json` exports for all new modules.

### API (`apps/api/src/`)

New modules (each with controller, service, module):

- `sales-orders/` — CRUD + confirm/cancel. Uses `DocumentType.SALES_ORDER`.
- `delivery-notes/` — Create/list/get + mark-delivered. Uses `DocumentType.DELIVERY_NOTE`.
- `suppliers/` — Full CRUD + deactivate. Master data for procurement.
- `credit-notes/` — Create/list/get + issue. Uses `DocumentType.CREDIT_NOTE` with
  `referenceDocumentId` link.
- `crm/` — `LeadsController` + `OpportunitiesController` with full CRUD. Leads have convert action.
- `projects/` — Full CRUD.
- `inventory/` — Full CRUD + deactivate.
- `documents/document-calculator.ts` — shared `calculateDocumentTotals` helper (replaces per-type
  calculators).
- Updated `app.module.ts` to import all new modules.
- Updated `security/business-access.service.ts` — added new `AuthorizationObject` types
  (`sales_orders`, `delivery_notes`, `credit_notes`, `suppliers`, `crm`, `projects`, `inventory`)
  and corresponding role permissions across all roles.

### Web UI (`apps/web/src/`)

New pages (list + create for each domain):

- `sales-orders/page.tsx`, `sales-orders/new/page.tsx`, `sales-orders/[salesOrderId]/`
- `delivery-notes/page.tsx`, `delivery-notes/new/page.tsx`
- `suppliers/page.tsx`, `suppliers/new/page.tsx`, `suppliers/[supplierId]/`
- `credit-notes/page.tsx`, `credit-notes/new/page.tsx`
- `leads/page.tsx`, `leads/new/page.tsx`
- `opportunities/page.tsx`, `opportunities/new/page.tsx`
- `projects/page.tsx`, `projects/new/page.tsx`
- `inventory/page.tsx`, `inventory/new/page.tsx`

New form components:

- `sales-order-form.tsx`, `delivery-note-form.tsx`, `supplier-form.tsx`, `credit-note-form.tsx`,
  `lead-form.tsx`, `opportunity-form.tsx`, `project-form.tsx`, `inventory-item-form.tsx`.
- Added `formatMinor` helper to `lib/display.ts`.

## Decisions and trade-offs

- **Reuse Document model for new doc types** — Sales Orders, Delivery Notes, and Credit Notes use
  the existing `Document` table with new `DocumentType` enum values. This preserves the existing
  numbering, workflow context, audit, and PDF infrastructure rather than creating parallel tables.
- **String status fields instead of Postgres enums** — Lead, Opportunity, Project, and InventoryItem
  use `VARCHAR` with string defaults rather than native Postgres enums. This avoids frequent enum
  alteration migrations and matches the existing `PurchaseOrderStatus` pattern.
- **Minimal but functional web UI** — List pages and create forms for each domain. Detail/edit pages
  are scaffolded as route directories but minimal for now (the route structure exists to be filled
  in).
- **Shared calculator** — `calculateDocumentTotals` in `document-calculator.ts` replaces the need
  for per-type calculators.
- **Authorization model** — New object types added to `ROLE_PERMISSIONS` following the existing
  pattern. OWNER/ADMIN get full CRUD; MEMBER gets create/read/update;
  STAFF/ACCOUNTANT/EXTERNAL_AUDITOR get read-appropriate access.

## Verification

```text
apps/api      tsc --noEmit                        # passed
apps/web      tsc --noEmit                        # passed
packages/contracts tsc --noEmit                   # passed
eslint (new files)                                # passed
pnpm graph                                        # 9 workspaces, 22 decision records
```

Not run: `pnpm test` (requires Docker PostgreSQL/Redis), `pnpm build` (known pre-existing web build
failure unrelated to these changes), `pnpm db:validate` (requires Docker).

## Follow-ups

1. **Detail/edit pages** — Route directories exist (`sales-orders/[salesOrderId]`,
   `suppliers/[supplierId]`) but need full detail/edit page implementations.
2. **Integration tests** — New services need unit + integration tests under `apps/api/src/`.
3. **Web UI navigation** — New pages are not yet linked from the main business navigation
   (`app-shell.tsx` or layout).
4. **Migration not applied** — Migration SQL is written but not applied to any database (requires
   Docker `postgres` service).
5. **Phase 3 (APIs/webhooks)** — Public API, developer portal, webhooks not started.
6. **Phase 6 (AI)** — OCR, RAG, AI copilot not started.
7. **Payment gateway links** — PRD specifies Stripe/Moyasar integration (requires paid service,
   conflicts with $0 budget — needs discussion).
8. **Supplier POs / Bills / GRN** — Supplier master is built; supplier-specific documents (supplier
   purchase orders, supplier bills, goods receipt notes) use the extended `DocumentType` enum but
   need dedicated service logic for 3-way matching.

## Handoff notes

- All new code passes `tsc --noEmit` and ESLint.
- The `Document` model now has many new relations; Prisma client was regenerated.
- The database migration must be applied (`pnpm --filter @bizo/database prisma:migrate:deploy`)
  before the new endpoints work against a live database.
- The `creditNoteAllocation` relation name in the `Document` model is `"CreditNoteAllocations"`
  (credit note side) and `"InvoiceCreditNoteAllocations"` (invoice side) — be aware when writing
  queries.
- The `updateCreditNoteRequestSchema` and `updateDeliveryNoteRequestSchema` exist in contracts but
  are not yet wired to API endpoints (the update methods exist in services but controllers only
  expose create/list/get/issue).
