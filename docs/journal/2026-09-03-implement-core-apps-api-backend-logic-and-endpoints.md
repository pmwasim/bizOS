# Implement core apps-api backend logic and endpoints

Date: 2026-09-03

Agent: jim

Scope: apps/api

Status: Complete

Related: ADR / issue / previous journal entry, or none

## Context

The API was on the post-TASK-30 inventory ledger, with Sprint 8 TASK-31 still todo: stock
reservations were not persisted and commercial lifecycle changes did not reserve or release stock.

## What changed

- Added `StockReservation` and optional `DocumentLine.inventoryItemId` to Prisma, with an additive
  migration and tenant/business RLS.
- Added transaction-scoped reservation, release, fulfillment/dispatch, and read-list logic to
  `InventoryService`, plus `GET .../inventory/stock/reservations`.
- Wired sales-order confirmation/cancellation, invoice ready/create/archive, and delivery-note
  fulfillment to the inventory service. Added optional inventory item IDs to quotation, invoice, and
  sales-order contracts and persisted them on lines.
- Added available-to-promise calculation and `GET .../inventory/stock/atp`, with reservation and ATP
  unit checks in `inventory.service.spec.ts`.
- Fixed fulfillment locking and partial delivered-quantity accounting, enforced ATP on manual
  dispatch/transfer, and fulfilled invoice stock on send without duplicating a source sales-order
  hold. ADR-0028 is accepted.

## Decisions and trade-offs

Reservations use the active default stock location, are one row per document/item/location, and
consume stock with a DISPATCH movement on delivery fulfillment. Lines without an explicit inventory
item remain non-stock lines for backward compatibility. The schema change is additive; rollback for
the local migration is dropping the new reservation table and nullable line column after any test
data is discarded (not run against production).

## Verification

Exact commands run and their real outcome. Distinguish passed, failed, and not run. A command that
was skipped because of a known pre-existing failure should say which failure.

```text
pnpm lint          # result
pnpm typecheck     # result
pnpm test          # result
```

Passed: database Prisma validation, contracts tests (180 passed), targeted API tests (32 passed),
full API tests (986 passed, 74 skipped), database tests (63 passed, 7 skipped), API/database/web/
contracts typechecks, root lint, API build, format check, and `pnpm agent:verify`. The additive
migration applied successfully to the local `bizo` PostgreSQL database. A real-PostgreSQL phase1
integration run passed all 10 tests, including reservation, ATP, fulfillment DISPATCH, and on-hand.
The security audit passed with no known vulnerabilities after the transitive dependency overrides.

## Follow-ups

No release blockers. The migration rollback is to drop `stock_reservations`, its RLS/indexes and
enum, then drop the `document_lines.inventory_item_id` foreign key/index/column after disposing of
local test data; it was not run.

## Handoff notes

Stock lines now carry optional `inventoryItemId` UUIDs; legacy lines without one remain non-stock.
Reservations use the active default location. Delivery fulfillment posts only delivered quantity,
leaving a remainder RESERVED; invoice send fulfills an invoice hold or its source SO hold. Local
migration `20260903000000_stock_reservations` is already applied; the fresh replay database was
dropped after verification.
