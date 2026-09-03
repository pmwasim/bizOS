# ADR-0029: Persisted FIFO and AVCO stock valuation

Status: Accepted Date: 2026-09-03 Deciders: Michael (god)

## Context

The stock ledger persists receipts, dispatches, signed adjustments, and signed transfers, but
inventory value needs a deterministic read model over those movements. The prior in-memory valuation
stub used JavaScript numbers and could not survive process restarts.

## Decision drivers

- Valuation must read the persisted `StockMovement` ledger and respect location filters.
- FIFO must consume oldest receipt layers first; AVCO must recompute a running weighted average.
- Money must remain exact integer minor-unit strings, without JavaScript number arithmetic.
- Signed adjustments and transfers must affect both quantity and valuation consistently.

## Decision

Expose a read-only valuation query supporting `FIFO` and `AVCO` (defaulting to FIFO). FIFO maintains
receipt-cost layers and consumes them on dispatch or negative signed movement. AVCO maintains an
exact rational running cost, returns its exact integer minor-unit asset value, and rounds the
average unit cost only at the output boundary using round-half-up
(`floor((2*numerator + denominator) / (2*denominator))`). Positive adjustments/transfers add a cost
layer; negative adjustments/transfers consume stock. A positive adjustment with a zero/default cost
inherits the current location valuation unit cost for the selected method. A positive transfer with
a zero/default cost inherits the source location's valuation unit cost at the transfer time
(transfer-at-cost); an explicitly recorded non-zero cost is used as-is. The result is derived at
request time from movements ordered by occurrence time and ID.

## Consequences

Valuation is always current and requires no new table or write-path change. Large ledgers trade
write simplicity for read-time replay; a future materialized valuation snapshot can optimize this
without changing the contract. Invalid historical outbound quantities are clamped at available
layers rather than producing negative inventory value.

## Validation and review trigger

Unit and real-PostgreSQL integration tests cover a known receipt, dispatch, signed-adjustment,
transfer-at-cost, and non-terminating AVCO rounding sequence under both methods. Revisit if
fractional quantities, lot/serial costing, or materialized period-close valuation is introduced.
