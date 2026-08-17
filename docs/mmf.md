# Minimum Marketable Feature

Status: Proposed for product-owner approval

Last updated: 2026-08-17

## Why this document exists

bizOS plans work by module ([MVP module plan](mvp-module-plan.md)) and releases it by outcome
([Roadmap](roadmap.md)). Neither unit answers the question a private beta actually has to answer:
**what is the smallest thing we can finish that a customer would pay for, and that we are allowed to
say out loud?**

A module is an engineering boundary. An outcome is a direction. A Minimum Marketable Feature is a
release unit. This document defines the term for bizOS, states the test a candidate has to pass, and
records the MMF currently in delivery.

## Definition

> A **Minimum Marketable Feature (MMF)** is the smallest slice of bizOS that a paying business can
> use on its own, that the business would notice if it were removed, and that bizOS can make a
> public claim about without qualifying the claim.

"Minimum" is a constraint on scope, not on quality. An MMF that is half-built is not an MMF; it is a
screen. The reduction happens in **breadth** — fewer entities, fewer options, one country, one
currency — never in **truthfulness, authorization, or auditability**.

## The five tests

A candidate is an MMF only when every answer is yes.

1. **Standalone value.** Can a business use it without waiting for the next slice? A feature whose
   value only arrives with a later slice is a step, not an MMF.
2. **Marketable claim.** Can it be written on the pricing page as a plain sentence, with no "coming
   soon", no asterisk, and no demo-only caveat? If the honest sentence needs a qualifier, the slice
   is not finished.
3. **Whole vertical.** Does it run end to end — UI, BFF, API, database, authorization, audit, tests
   — for every role permitted to use it? A surface backed by a placeholder is not an MMF at any
   completion percentage.
4. **Truthful numbers.** Is every value on screen derived from a record the business created? bizOS
   shows money. A fabricated, estimated, illustrative, or fallback figure presented as business data
   disqualifies the slice outright. This test has no partial credit.
5. **Reversible and observable.** Can it be released behind the existing gates and withdrawn without
   corrupting records, and does a failure show up as a failure rather than as a plausible number?

Tests 1 and 2 are product tests; the product owner answers them. Tests 3, 4 and 5 are delivery
tests; the quality gate and the release evidence answer them.

## How an MMF relates to the existing planning units

| Unit           | Question it answers                      | Owner             |
| -------------- | ---------------------------------------- | ----------------- |
| Outcome        | Where is the product going?              | Product owner     |
| Module         | Where does this code live and belong?    | Architecture      |
| **MMF**        | **What ships next, and can we sell it?** | **Product owner** |
| Vertical slice | How is it built and proven?              | Delivery          |

An MMF usually lives inside one module and is delivered as one vertical slice. It may cross modules
when the marketable claim does — the claim is the boundary, not the code layout.

## Anti-patterns this definition exists to stop

- **The demo surface.** A page that renders convincing values from constants, percentages of another
  number, or a fallback branch taken when the API is unreachable. It passes a walkthrough and fails
  test 4.
- **The sold-but-unbuilt claim.** A capability named on the pricing page ahead of the slice that
  delivers it. The claim is the commitment; the code has to arrive first.
- **The module rush.** Opening a new module because its screens are cheap, while an earlier module's
  claim is still unbacked. Breadth of navigation is not breadth of product.
- **The silent fallback.** Catching an error and substituting representative data. A statement that
  cannot load must say so; a statement that quietly invents lines is worse than an outage, because
  the business acts on it.

---

## MMF-1 — "Money customers owe"

Status: In delivery

### The claim

> **See exactly who owes you, how much, and how late it is — from the invoices and payments you
> already recorded in bizOS.**

### Why this one

The journey from a new customer to a sent invoice is built and has production evidence. The step
after it is the one a small business actually feels: the invoice is out, and now someone has to know
who has not paid. [Roadmap](roadmap.md) step 7 and [module 8](mvp-module-plan.md) name it. The
[pricing page](https://bizos.qloudihub.com/pricing) already sells "statements" in the Starter plan.

It also fails test 4 today. The statements surface computes its ageing tiers as fixed percentages of
the closing balance (40/30/15/10/5), falls back to hard-coded invoice and payment lines when the API
call fails — which it always does, because the BFF route it calls does not exist — and renders a
supplier statement entirely from constants. Every number on that page is invented, and it is
invented in the one place a business uses to decide who to chase. Closing that gap is not a bug fix
on the way to something else; it _is_ the marketable feature, and until it is closed bizOS cannot
honestly make the claim it is already making.

### In scope

1. **Receivables summary for the business.** Every customer with an unsettled issued invoice, their
   outstanding amount, their overdue amount, their oldest due date, and a five-bucket ageing
   breakdown — computed per invoice from that invoice's own due date and its own settlement, then
   summed. Business totals across customers.
2. **Customer account statement.** A date-ranged ledger for one customer with a true opening balance
   carried forward from before the period: issued invoices as debits, completed payment allocations
   and issued credit-note allocations as credits, a running balance, and period totals.
3. **Honest currency.** Amounts are reported in the business base currency at the business currency
   scale. Documents in any other currency are excluded from the totals and the other currencies are
   named in the response, rather than being summed as if they were comparable.
4. **A real path from the browser to the API.** The statements surface is rendered on the server
   from the API response it claims to read, rather than from a client fetch to a route that does not
   exist, and it shows a visible error state when the read fails.
5. **Removal of every fabricated value on the statements surface**, including the mocked supplier
   statement, which is replaced by an honest "not available yet" rather than by plausible numbers.

### Out of scope, and named

Deferred deliberately, because the claim above does not need them:

- statement PDF export and email delivery (the chase, not the answer);
- supplier statements and payables ageing (the mirror image, a separate claim);
- multi-currency consolidation at an exchange rate;
- ERPNext ledger passthrough and journal-level evidence;
- dunning, reminders, and automation.

### Acceptance criteria

| #   | Criterion                                                                                                                          |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Only `SENT` invoices are receivables. Draft, ready-to-send, failed-to-send, and archived invoices never appear as debits.          |
| A2  | An invoice's outstanding amount is its total less completed payment allocations less issued credit-note allocations against it.    |
| A3  | A fully settled invoice contributes nothing to any ageing bucket.                                                                  |
| A4  | Ageing buckets are derived from each invoice's own due date against the as-of date: not yet due, 1–30, 31–60, 61–90, over 90 days. |
| A5  | An invoice with no due date is aged from its issue date, and never silently treated as not yet due.                                |
| A6  | Bucket amounts sum exactly to the outstanding total; no rounding, apportioning, or estimation anywhere in the calculation.         |
| A7  | A reversed payment settles nothing and restores the invoice to its ageing bucket.                                                  |
| A8  | One customer's receipts never appear on another customer's statement, and a payment split across invoices credits only its share.  |
| A9  | The opening balance equals the closing balance of the period immediately before the requested start date.                          |
| A10 | Amounts are reported in the business base currency and scale; other currencies are excluded and named, never summed.               |
| A11 | Every role holding `payments:read` can read both views; no other role can, and neither view crosses a business boundary.           |
| A12 | When the API cannot be reached the surface reports the failure. No fallback, illustrative, or example figure is ever rendered.     |

### Verification

The quality gate (`pnpm check`) plus the unit tests added with the slice. A1–A11 are asserted in
`apps/api/src/statements/statements.service.spec.ts`, with bucket boundaries and exact
reconciliation isolated in `apps/api/src/statements/ageing.spec.ts`. A12 is asserted by the absence
of any fallback branch in the statements surface: the surface is server-rendered, so there is no
client error path in which substitute data could be returned.

A7, A8 and A11 are asserted against `receivables()` specifically, not only against `customer()`.
They were the three criteria this document claimed and the suite did not cover — a reversed payment
settling nothing, a split payment crediting only its own share, and the permission check on the
business-wide view. A criterion recorded here and unasserted in the suite is the same defect as a
fabricated number on screen: the document says something the product has not shown to be true.

### Claim readiness

The pricing-page claim in the Starter plan is only honest once this MMF passes its acceptance
criteria against real data in a deployed environment. Until that evidence is recorded, the claim
reads as beta scope rather than as a shipped capability.

**Status: resolved as of 2026-08-17.** "Customer statements & ledger views" is marked `beta` in the
Starter plan, and `pricing-table.tsx` carries a note defining what beta means — built and usable,
not yet verified against real business data. The marker comes off when the deployed-data evidence
lands in
[invoice-vertical-slice-production-evidence.md](operations/invoice-vertical-slice-production-evidence.md),
not before. `PricingPlan.features` accepts `{ label, beta: true }` so the next unverified claim has
somewhere honest to go.
