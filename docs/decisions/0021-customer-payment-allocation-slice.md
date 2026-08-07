# ADR-0021: Customer payment and invoice allocation slice

Status: Accepted

Date: 2026-07-28

Deciders: Product and engineering

## Context

ADR-0018 delivered sent invoices without payment balance semantics. Stage C of the PRD requires
receivables starting with customer payments. Default ERP and Service PO & Approval both already
define an invoice workflow transition `record-payment` → `paid`, but no payment facts existed.

## Decision drivers

- Record money received against a sent invoice without rewriting immutable invoice totals.
- Support partial payments in the first slice.
- Keep payment facts separate from `Document` (same pattern as purchase orders).
- Remain at $0 operating cost with no new npm dependencies.
- Work for both Default ERP and Service PO configurations once an invoice is `SENT`.

## Decision

1. Add `CustomerPayment` and `PaymentAllocation` aggregates with tenant/business RLS.
2. Allocate a payment to exactly one sent invoice in this slice; amount must be ≤ outstanding.
3. Derive invoice balance (`UNPAID` / `PARTIALLY_PAID` / `PAID`) from non-voided allocations.
4. Soft-void payments instead of deleting; voided allocations leave outstanding balance.
5. Do not add `DocumentStatus.PAID`; keep document status as send-lifecycle only.
6. Enable the `payments` module in the catalog and configuration seeds.

## Explicit non-goals

Receipt PDFs, statements, credit notes/refunds, multi-invoice allocation in one request, payment
gateways, supplier payments, and GL export.

## Consequences

Sent invoices gain a payments panel and outstanding balance. Navigation shows Payments when the
module is implemented and enabled. Historical invoices remain unchanged until payments are recorded.
