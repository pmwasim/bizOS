# Define the MMF and deliver "Money customers owe"

Date: 2026-08-17

Agent: claude-cowork

Scope: docs, packages/contracts/src/statements.ts, apps/api/src/statements, apps/web statements
surface

Status: Ready for review

Related: [ADR-0024](../decisions/0024-receivables-and-statements-are-derived-per-currency.md),
[ADR-0023](../decisions/0023-invoice-settlement-is-derived.md), [MMF](../mmf.md), previous entry
[audit issue 60 and the payment void gap](2026-08-15-audit-issue-60-blobs-and-close-the-payment-void-gap.md)

## Context

The request was to define what a Minimum Marketable Feature means for bizOS and then implement one,
after auditing both the repository and the deployed site at `bizos.qloudihub.com`.

The repository at `0025523` has the quotation → invoice → payment journey built with production
evidence. The audit turned up one thing that decided the MMF rather than leaving it a matter of
preference:

- `apps/web/src/components/statements-client-view.tsx` computed its "5-Tier Aging Breakdown" as
  fixed proportions of the closing balance — 40%, 30%, 15%, 10%, remainder. No due date was involved
  at any point.
- The same component fetched `/api/businesses/:businessId/statements/customers/:customerId`. That
  Next.js route handler does not exist, so every request 404'd, every request took the `catch`
  branch, and the `catch` branch rendered `Invoice #INV-1001 / 150000` as the customer's data. The
  supplier tab called nothing at all — `BILL-2001 / 85000` was a constant.
- Even on the intended path the component read `data.lines`, `currencyCode`, `currencyScale`; the
  API returns `items`, `currency`, and no scale. The shapes had never matched.
- `StatementsService.customer` read `customer.currencyCode`. `Customer` has no such column, so
  `?? "USD"` fired on every statement in a product whose launch markets are SAR, AED, and INR. The
  unit test missed it because the fixture declared a `currencyCode` the database does not have.
- The pricing page sells "statements" in the Starter plan at SAR 63/month.

## What changed

**Definition.** `docs/mmf.md` defines MMF for bizOS, states the five tests a candidate must pass
(standalone value, marketable claim, whole vertical, truthful numbers, reversible and observable),
names the anti-patterns, and records MMF-1 "Money customers owe" with twelve acceptance criteria and
an explicit out-of-scope list.

**Decision.** ADR-0024 records that receivables and statements are derived on read per invoice, that
ageing is a property of the invoice rather than of the balance, that other currencies are named and
excluded rather than converted, and that no bizOS surface may substitute data when a money query
fails.

**Contracts** (`packages/contracts/src/statements.ts`, rewritten). Added `ageingBucketsSchema`,
`receivableCustomerSchema`, `receivablesSummarySchema`, and `receivablesQuerySchema`. Statement
lines gained `CREDIT_NOTE`, `dueDate`, and `currencyScale`; the statement gained period bounds,
`asOf`, buckets, `totalCreditedMinor`, and `otherCurrencies`. Dates are constrained to `YYYY-MM-DD`,
and `statementQuerySchema` rejects a period that ends before it starts.

**API.**

- `apps/api/src/statements/ageing.ts` (new) — `daysPastDue`, `bucketFor`, `ageInvoices`,
  `addBuckets`, `overdueTotal`. Each invoice lands in exactly one bucket for its whole amount, so
  the five buckets reconcile to the outstanding total exactly.
- `apps/api/src/statements/statements.service.ts` — added `receivables()`, the per-business query
  ADR-0023 left open. Both methods now load invoices, completed payment allocations, and issued
  credit-note allocations through one `load()` helper, read the currency from
  `Business.baseCurrency` and `Business.currencyScale`, honour `startDate`/`endDate` with a true
  opening balance, and drop settlement dated after the as-of date.
- `apps/api/src/statements/statements.controller.ts` — added
  `GET /businesses/:businessId/statements/receivables`, and both endpoints validate their query
  string through `ContractPipe`.

**Web.**

- Deleted `apps/web/src/components/statements-client-view.tsx` entirely.
- `apps/web/src/app/b/[businessId]/statements/page.tsx` rewritten as a server component that renders
  from the API response, driven by `customerId` / `startDate` / `endDate` search parameters through
  a plain GET form (no client JavaScript, so no fallback branch is reachable). A failed read renders
  an explicit `role="alert"` panel and nothing else.
- New `receivables-summary.tsx` and `customer-statement.tsx` server components.
- `app-shell.tsx` — the statements page had no nav entry at all and was reachable only by typing the
  URL. It now follows the `payments` module into the sidebar as "Money Owed".

**Tests.** `statements.service.spec.ts` rewritten (20 tests) covering acceptance criteria A1–A11;
`ageing.spec.ts` added (6 tests) covering bucket boundaries and exact reconciliation. The FEAT-16
block in `test/e2e/payments-statements.e2e-spec.ts` was rewritten: its Tier 3 test reimplemented
bucketing inline and asserted its own loop, and its Tier 4 test asserted that a two-element array
had two elements. Both now exercise the service.

**Indexes.** `docs/README.md` lists the MMF document; `docs/decisions/README.md` was missing
ADR-0023 and now lists 0023 and 0024.

## Decisions and trade-offs

- **Ageing per invoice, not per balance.** A customer with a settled old invoice and an unpaid new
  one ages entirely wrong under any balance-level rule. Recorded in ADR-0024.
- **Exclude other currencies rather than convert them.** There is no rate source, no rate-date
  policy, and no restatement rule. Summing at an implied 1:1 rate would be a fabricated total, which
  is the exact failure this MMF exists to remove. The response names what it left out.
- **Server-rendered rather than a new BFF route.** A client fetch needs an error path, and an error
  path is where the fabricated data lived. Rendering on the server through `apiJson` removes the
  branch rather than fixing it.
- **The mocked supplier statement was deleted, not repaired.** Payables ageing is a separate claim
  and gets its own MMF; a placeholder would fail test 4 in the meantime.
- **Aged a missing due date from the issue date.** Treating it as "not yet due" would file the
  oldest debts in the safest bucket.

## Verification

Run in a clean clone of `main` at `0025523`, in a sandbox container.

```text
pnpm install --frozen-lockfile                 # passed
pnpm format:check                              # passed
pnpm docs:check                                # passed — all local Markdown links resolve
pnpm lint                                      # passed
pnpm typecheck                                 # passed
pnpm test                                      # passed — 676 passed, 52 skipped (728)
pnpm db:validate                               # passed
pnpm build                                     # passed
pnpm check                                     # passed end to end, exit 0
```

Not run: the Playwright e2e suite and any check requiring PostgreSQL, Redis, or SMTP — this sandbox
has no Docker daemon. `@bizo/queue` logs `ECONNREFUSED 127.0.0.1:6379` inside tests that pass
regardless; that is pre-existing and unrelated.

Note for whoever repeats this: `NODE_ENV=production pnpm check` fails
`src/dependency-injection.spec.ts` with "Production object storage requires R2 credentials". That is
the environment, not the change — CI runs with `NODE_ENV` unset and passes.

Not verified: behaviour against real data in a deployed environment. Every figure here is
unit-tested against mocked rows, so the acceptance criteria are proven as logic, not yet as
evidence.

## Follow-ups

- **Release blocker until closed.** The Starter plan on the pricing page sells "statements" as a
  shipped capability. It is honest only once MMF-1 is verified against real data in a deployed
  environment. Until that evidence exists the claim should read as beta scope.
- The same fabricated-data pattern is still live on four other surfaces and fails the same test:
  `inventory-client-view.tsx` (`mockItem`), `projects-client-view.tsx` (`mockProj`),
  `credit-notes-client-view.tsx` (`mockNote`), and the CRM activity feed (`crm-client-view.tsx`,
  "Activity Feed Timeline Mock Data (FEAT-27)"). Each shows invented records as the business's own.
  Worth a single audit pass.
- ADR-0023 and ADR-0024 are both `Proposed`. Marking an ADR `Accepted` needs a human.
- Statement PDF export and email delivery, reusing the invoice delivery path.
- Supplier statements and payables ageing as MMF-2.
- A rate source and restatement policy before any cross-currency total is shown.
- `receivables()` does its bucketing in the API over three queries. Fine at private-beta volume; if
  profiling shows it is hot, the answer is an aggregate query or a materialised view, never a stored
  column.

## Handoff notes

- The statements contract changed shape. There were no other consumers — the only caller was reading
  a shape the API never returned — but check before assuming compatibility.
- `Customer` still has no currency column and deliberately does not need one. If you see
  `customer.currencyCode` anywhere, it is a bug of the same family as the one removed here.
- `apps/api/src/statements/ageing.ts` is pure and has no database dependency. Test bucket rules
  there, not through the service.
- The e2e suite has two files per spec in its run output (`test/e2e/...` and `apps/api/test/e2e/...`
  are both collected); that is a pre-existing vitest configuration quirk, not a duplicate test.
- No claim was taken with `pnpm agent:claim` — this session ran against a sandbox clone rather than
  the working tree, so the files were written back afterwards. Claim before editing in place.
