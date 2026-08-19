# ADR-0025: Payment voiding, reversal, and refunds

Status: Accepted  
Date: 2026-08-18  
Deciders: Product owner  
Accepted: 2026-08-18 — implemented in `PaymentsService.void` / `.reverse` / `.refund`, migration
`20260818000000_payment_void_reversal_refund`, and the payment-detail actions on the web.

## Context

TASK-14 (ADR-0023) made invoice settlement a pure derivation over `COMPLETED`, non-reversed
`payment_allocations`. A reversal is therefore already correct for free: moving a payment out of
`COMPLETED` drops its allocations from every derived figure with no compensating write.

TASK-15 completes the undo/return story around that derivation with three distinct operations, each
fail-closed with its own error code:

- **Void** a `DRAFT` payment — one that never settled anything.
- **Reverse** a `COMPLETED` payment — un-settle the invoices it covered.
- **Refund** a `COMPLETED` payment — return money to the customer.

The design question is how to model a refund, and how each transition guards its state machine
against illegal or concurrent transitions.

## Decision drivers

- Settlement stays derived (ADR-0023). No operation may reintroduce a stored, drifting balance.
- Money is never destroyed or silently rewritten — an undo is auditable, not a mutation in place.
- Every illegal transition fails closed with a distinct, machine-readable code.
- Concurrent double-undo of the same payment must be serialized, matching the Sprint-2/3 converts.

## Decision

### A new terminal status: `VOIDED`

`PaymentStatus` gains `VOIDED`. A `DRAFT` payment voids to it; the status is terminal, so `update`,
`markAsCompleted`, `reverse`, and `refund` all reject a voided payment. Voiding never touches
settlement because a draft's allocations never counted. Modelled as an enum member, not a cast.

### The payment state machine

```
DRAFT ──complete──▶ COMPLETED ──reverse──▶ REVERSED   (terminal)
  │                     │
  │                     └────refund───▶ COMPLETED (+ PaymentRefund rows)
  └──void──▶ VOIDED   (terminal)
```

Fail-closed invariants, each with its own code:

- `void` a non-`DRAFT` → `PAYMENT_NOT_DRAFT`.
- `reverse` a `DRAFT`/other → `PAYMENT_NOT_COMPLETED`; a `REVERSED` → `PAYMENT_ALREADY_REVERSED`; a
  `VOIDED` → `PAYMENT_VOIDED`.
- `refund` a non-`COMPLETED` → `PAYMENT_NOT_COMPLETED`.
- `refund` whose cumulative total would exceed the payment amount →
  `PAYMENT_REFUND_EXCEEDS_BALANCE`.

### Refunds are a distinct, append-only ledger

A refund is recorded as a `payment_refunds` row (positive magnitude returned, its own
currency/scale, optional reason, actor, timestamp) against the payment. The original payment amount
is **never** mutated. The net position is derived — `netAmountMinor = amountMinor − Σ refunds`,
floored at zero — exactly as settlement is derived from allocations. This mirrors ADR-0023: one
place records the movement, everything else is computed, and there is no denormalised total to
drift.

The cumulative refunded amount is fail-closed to never exceed the payment amount, checked inside the
transaction after the advisory lock so concurrent refunds cannot race past the balance.

### Reversal is the operation that un-settles invoices; refund is not

Reversal un-settles invoices (via the `COMPLETED` filter, per ADR-0023). A refund is deliberately a
**separate cash-return record** that adjusts the customer/payment net position without silently
re-opening an invoice a reversal did not touch. This keeps the two operations — "the payment was a
mistake" (reverse) versus "we returned some money" (refund) — cleanly separated, and avoids
attributing a per-payment refund back across multiple invoice allocations with proportional
rounding. The derived customer position (`netAmountMinor`, `refundedMinor`, surfaced on the payment)
stays correct; invoice settlement remains a pure function of `COMPLETED` allocations.

### Concurrency

`void`, `reverse`, and `refund` each take a transaction-scoped `pg_advisory_xact_lock` keyed on
`payment-mutate:<publicId>` before reading status, so concurrent undos of the same payment serialize
and the status/balance rechecks that follow are authoritative — the same pattern as the
quotation→invoice and PO→bill converts.

## Options considered

**Mutate the payment `amountMinor` on refund.** Rejected. Destroys the original figure, breaks the
audit trail, and reintroduces a stored balance that drifts — the exact failure ADR-0023 removed.

**Add a `REFUNDED` status.** Rejected. A payment can be partially refunded and remain live; status
is the wrong axis. A refund is a movement (a row), not a lifecycle state.

**Make a refund re-open invoice settlement proportionally.** Rejected for this slice. A refund is
per-payment; attributing it back across a payment's several invoice allocations needs a proration
with integer-minor rounding that is fragile and untestable, and it conflates refund with reversal.
Reversal already provides exact invoice reversion when that is the intent.

## Consequences

- New `payment_refunds` table with the standard `tenant_business_isolation` RLS policy.
- `Payment` contract gains `refunds`, `refundedMinor`, and `netAmountMinor` (all derived on read).
- New `payments:void` and `payments:refund` authorization actions, granted to OWNER and ADMIN
  alongside the existing `payments:reverse`.
- Endpoints: `PATCH …/payments/:id/status/void`, `POST …/payments/:id/refunds`; `…/status/reverse`
  now accepts an optional reason.
