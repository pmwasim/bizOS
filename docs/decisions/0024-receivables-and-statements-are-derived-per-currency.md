# ADR-0024: Receivables and statements are derived per currency, and never estimated

Status: Accepted  
Date: 2026-08-17  
Deciders: Product owner  
Accepted: 2026-08-18 — verified against implementation by Michael (orchestrator). Ageing lives in
`statements/ageing.ts` with the five per-invoice buckets (not-yet-due / 1–30 / 31–60 / 61–90 /
over-90), aged from due date and from issue date when none ("due on issue"); outstanding is total
less `COMPLETED` payment allocations less `SENT` credit-note allocations, floored at zero
(`ISSUED_STATUSES = SENT`); totals are in business base currency with other-currency documents
excluded and named in `otherCurrencies` (never converted); opening balance sums entries strictly
before `periodStart`; the fabricated-ageing/mock-fallback `statements-client-view.tsx` was deleted
and rebuilt as `customer-statement.tsx` / `receivables-summary.tsx` / `payables-summary.tsx`, which
fail closed. Follow-up (non-blocking): one residual `as never` enum-literal cast remains in
`payments.service.ts`.

## Context

[ADR-0023](0023-invoice-settlement-is-derived.md) made settlement a derivation over
`payment_allocations` and left one follow-up open: "a per-business receivables view (all outstanding
invoices in one query) is unbuilt". [MMF-1](../mmf.md) makes that view the next marketable feature,
so the derivation now has to answer two more questions it has never been asked — _how late is it_,
and _in what currency_.

Three things in the current statements surface forced the decision rather than deferred it.

**Ageing was fabricated.** `apps/web/src/components/statements-client-view.tsx` computed its five
ageing tiers as fixed proportions of the closing balance — 40%, 30%, 15%, 10%, and the remainder —
and labelled them "Current (0-30d)" through "120+ Days". The numbers moved when the balance moved,
so they looked alive. They were never derived from a due date.

**The surface never reached the API.** The component fetches
`/api/businesses/:businessId/statements/customers/:customerId`, and no such Next.js route handler
exists. Every request 404s, every request takes the `catch` branch, and the `catch` branch renders
hard-coded lines — `Invoice #INV-1001`, `150000` — as if they were the customer's. The supplier tab
never calls anything at all; `BILL-2001 / 85000` is a constant.

**Currency was wrong even on the honest path.** `StatementsService.customer` reads
`customer.currencyCode`. The `Customer` model has no such column. The expression is `undefined` at
run time and the `?? "USD"` fallback fires for every statement, in a product whose launch markets
are SAR, AED, and INR. The unit test did not catch it because the test's fixture object declares a
`currencyCode` the database does not have.

## Decision drivers

- Money on screen must be traceable to a record the business created. This is test 4 of the
  [MMF definition](../mmf.md) and it has no partial credit.
- Ageing decides who gets chased. Being approximately right here is worse than being unavailable,
  because the business acts on it either way.
- The launch markets are not USD, and a customer's documents are not guaranteed to share one
  currency.
- ADR-0023 established that allocations are authoritative. Nothing here may reintroduce a stored
  balance.

## Options considered

**Age the customer's closing balance as a whole.** One number, one bucket rule, cheap. Rejected: a
customer with a paid old invoice and an unpaid new one ages entirely wrong, because the balance has
no due date — only invoices do.

**Age each invoice by its own due date, and sum.** Chosen. The bucket is a property of the invoice,
the outstanding amount is the ADR-0023 derivation for that invoice, and the customer's ageing is the
sum over their invoices. Every bucket total decomposes back to the invoices that produced it.

**Store an `ageing_bucket` column, refreshed nightly.** Rejected. It is a stored derivation of a
value that changes at midnight without any write occurring — the drift class ADR-0023 removed.

**Convert other currencies into the base currency for the totals.** Rejected for this MMF. It
requires a rate source, a rate date policy, and a restatement rule, none of which exist. Summing at
an implied 1:1 rate would be a fabricated number wearing a total's clothes.

## Decision

**1. Receivables and statements are derived on read, per invoice, from `documents` and
`payment_allocations` and `credit_note_allocations`.** Nothing is stored, cached, or refreshed.

**2. An invoice's outstanding amount is its total, less allocations from `COMPLETED` payments, less
allocations from `SENT` credit notes, floored at zero.** Only `SENT` invoices are receivables, per
ADR-0023.

**3. Ageing is a property of the invoice, not of the balance.** Each invoice with a non-zero
outstanding amount falls in exactly one bucket, chosen by whole days between its due date and the
as-of date: not yet due, 1–30, 31–60, 61–90, over 90. An invoice with no due date is aged from its
issue date — a missing due date means "due on issue", never "not yet due". Bucket totals are sums of
whole invoice amounts, so they reconcile exactly to the outstanding total with no apportioning.

**4. Both views are reported in the business base currency at the business currency scale.**
Documents in another currency are excluded from every total and their currency codes are returned in
`otherCurrencies`, so the surface can say what it left out. They are never converted and never
summed.

**5. The statement's opening balance is the closing balance of everything strictly before the period
start**, derived from the same ledger, so a date range never silently drops history.

**6. No surface in bizOS may substitute data when a money query fails.** A failure renders as a
failure. This applies to the statements page and to every page after it.

## Consequences

- Receivables reads three tables per request and does the bucketing in the API rather than in SQL.
  For a private-beta business this is a single indexed scan over its own issued invoices; if
  profiling later shows it is hot, the answer is an aggregate query or a materialised view, not a
  column.
- `Customer` has no currency of its own, and after this ADR does not need one — a statement's
  currency comes from the business, and a document's currency comes from the document.
- A business invoicing in two currencies sees one set of totals plus a named exclusion. That is a
  visible limitation, and it is the correct one until a rate policy exists.
- The mocked supplier statement is removed rather than repaired. Payables ageing is a separate claim
  and will get its own MMF.
- The existing statements contract changes shape (`items` gains `CREDIT_NOTE`, the response gains
  buckets, scale, period, and `otherCurrencies`). It has no external consumers — the only caller was
  reading a shape the API never returned.

## Follow-ups

- Statement PDF export and email delivery, reusing the invoice delivery path.
- Supplier statements and payables ageing as MMF-2.
- A rate source and restatement policy before any cross-currency total is displayed.
- The same audit applied to the other surfaces that carry mock fallbacks:
  `inventory-client-view.tsx`, `projects-client-view.tsx`, `credit-notes-client-view.tsx`, and the
  CRM activity feed. They are outside this MMF but they fail the same test.
