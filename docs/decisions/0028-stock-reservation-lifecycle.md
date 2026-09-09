# ADR-0028: Stock reservation lifecycle

Status: Proposed Date: 2026-09-03 Deciders: Product owner

## Context

The multi-location movement journal (TASK-30) derives on-hand stock, but confirmed sales documents
need an atomic hold so concurrent orders cannot promise the same units. A hold must also survive
process restarts and leave an auditable stock movement when fulfilled.

## Decision drivers

- Reservation availability must be checked and written in one scoped transaction.
- Tenant and business isolation must be enforced by PostgreSQL RLS.
- Cancellation must not fabricate a compensating movement; fulfillment must reduce on-hand exactly
  once.
- Existing free-form service lines remain valid and non-stock.

## Decision

Persist one `StockReservation` per document, inventory item, and active default location. A sales
order confirmation and an invoice becoming ready reserve whole inventory units after subtracting
other active holds. Cancellation/archive changes `RESERVED` to `RELEASED`. Delivery fulfillment
changes the hold to `FULFILLED` and appends one positive `DISPATCH` movement. Commercial lines carry
an optional `inventoryItemId`; omitted IDs are treated as non-stock lines for backward
compatibility.

All lifecycle writes run through `InventoryService` inside the caller's database transaction and use
the existing per-item advisory lock. The reservation table is append-preserving: status timestamps
record release/fulfillment rather than deleting the original hold.

## Consequences

The schema adds `stock_reservations`, a nullable inventory-item reference on document lines, and
RLS/indexes for active-hold queries. A business must have an active default location before a stock
line can be confirmed or invoiced. Fractional stock quantities are rejected at reservation time;
future lot/serial tracking can extend the reservation key without changing document lifecycle APIs.

## Validation and review trigger

The real-PostgreSQL phase1 integration covers receipt → reservation → delivery dispatch and on-hand.
Revisit when multiple fulfillment locations, fractional/batch stock, or partial fulfillment is
required.
