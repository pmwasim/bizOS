# ADR-0023: Invoice settlement is derived, not stored

Status: Accepted  
Date: 2026-08-15  
Deciders: Product owner  
Accepted: 2026-08-18 — verified against implementation by Michael (orchestrator). `DocumentStatus`
has exactly the five lifecycle members; no `amount_paid_minor` column; the swallowed denormalisation
writes are gone; `PaymentsService.invoicePaymentSummary` derives paid/outstanding from `COMPLETED`
payment allocations floored at zero and is exposed as
`GET /businesses/:businessId/invoices/:invoiceId/payments` on `invoices.controller.ts`.

## Context

`PaymentsService.complete` and `PaymentsService.reverse` each tried to keep an invoice in step with
its payments by writing two things onto the `documents` row: a `status` of `PAID` or `PARTIAL`, and
a running `amountPaidMinor`.

Neither exists. `DocumentStatus` has exactly five members — `DRAFT`, `READY_TO_SEND`, `SENT`,
`SEND_FAILED`, `ARCHIVED` — and the `documents` table has no `amount_paid_minor` column. The writes
were cast through `as never` so TypeScript could not object, and wrapped in a bare `catch {}` that
swallowed the resulting runtime error. The observable behaviour was that completing a payment
succeeded, the payment was marked `COMPLETED`, the invoice was untouched, and nothing was logged.

The same gap left `GET /businesses/:businessId/invoices/:invoiceId/payments` unimplemented while the
record-payment screen already called it, so that screen 404'd before it could render.

`payment_allocations` already records, per payment and per invoice, exactly how much was applied.

## Decision drivers

- One place records settlement. Two places disagree eventually.
- A reversal must leave the invoice exactly as it was before the payment.
- Overpayment and partial payment must both be representable without new enum members.
- The release is blocked; a schema migration touching an enum used across every document flow is the
  wrong risk to take this week.

## Options considered

**Add `PAID`/`PARTIAL` to `DocumentStatus` and an `amount_paid_minor` column.** Makes the existing
code correct as written and gives a cheap read. But `DocumentStatus` is shared by quotations,
purchase orders, and delivery notes, none of which have a notion of payment; the new members would
be meaningless for them and reachable in every status filter in the product. It also creates a
denormalised total that must be kept in step under concurrent payments, reversals, and partial
allocations — the class of bug that motivated this ADR.

**Derive settlement from allocations on read.** Chosen. `paidMinor` is the sum of allocation amounts
on `COMPLETED` payments for that document; `outstandingMinor` is the invoice total less that,
floored at zero. A reversal moves the payment out of `COMPLETED` and the derivation follows with no
compensating write. Overpayment is representable without a negative balance — the surplus is already
audited as `customer.overpayment_credited`.

**Leave the swallowed writes in place.** Rejected. Silent failure on a money path.

## Decision

Invoice settlement is derived from `payment_allocations`, never stored on the document.

`PaymentsService.invoicePaymentSummary` is the single derivation, exposed as
`GET /businesses/:businessId/invoices/:invoiceId/payments`. The dead denormalisation in `complete`
and `reverse` is removed rather than repaired.

## Consequences

- Settlement cannot drift from the payments that produced it, because there is nothing to drift.
- Listing many invoices with their outstanding balances will need an aggregate query rather than a
  column read. That query does not exist yet; the current screens read one invoice at a time.
- `DocumentStatus` keeps meaning "where is this document in its send lifecycle", which is the only
  question every document type can answer.
- Customer statements gain a matching rule: only `SENT` invoices are receivables. See
  `apps/api/src/statements/statements.service.ts`.

## Follow-ups

- A per-business receivables view (all outstanding invoices in one query) is unbuilt.
- If profiling later shows the derivation is hot, a materialised view is the next step, not a column
  — it keeps allocations authoritative.
