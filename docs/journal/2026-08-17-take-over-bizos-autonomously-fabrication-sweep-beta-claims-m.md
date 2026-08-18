# Take over bizOS autonomously: fabrication sweep, beta claims, MMF-2

Date: 2026-08-17

Agent: claude-cowork

Scope: docs, apps, packages

Status: Ready for review

Related: [MMF](../mmf.md), [AGENTS.md](../../AGENTS.md),
[ADR-0024](../decisions/0024-receivables-and-statements-are-derived-per-currency.md), previous entry
[close the MMF-1 write-back gap](2026-08-17-close-the-mmf-1-write-back-gap-and-assert-a7-a8-a11.md)

## Context

The repository owner delegated full authority and asked for autonomous operation, plus an update to
the agent protocol to match. Four priorities were named: commit the MMF-1 work, remove the remaining
fabricated-data surfaces, close the pricing-page release blocker, and ship MMF-2.

`main` was at `0025523` with the MMF-1 slice sitting uncommitted because the old protocol reserved
merges for a human.

## What changed

**Authority (`AGENTS.md`).** The "do not do these without a human" section is replaced. Agents now
commit, merge, tag, accept ADRs, deploy and handle credentials without asking. The replacement keys
on **reversibility** rather than permission, in three tiers: reversible by one command, recoverable
with downtime, irreversible. Tier 3 still stops — not for approval, but because a recovery path must
exist and have been tested in the session before something with no undo runs. Added explicit stop
conditions, a secrets-disclosure rule, and a section on honesty in the journal, which is now the
only record of what an unsupervised agent did.

**Commits.** MMF-1 landed as three commits (`9c5d477`, `c3fd5bc`, `f616f57`), split by concern
rather than as one drop.

**Fabrication sweep.** The four surfaces carried more than the mock reads recorded in the previous
entry:

- All four added a record to local state when the server **rejected** the write. The credit-note
  case invented an `ISSUED` note with a random number — and receivables now net issued credit notes
  off each invoice, so a phantom one understates real debt.
- `crm-client-view.tsx` ran the identical "mark CONVERTED" branch on success, on failure, and on
  exception, so a rejected conversion still showed a customer that did not exist.
- `updateOppStage` never called the API at all. Moving a card looked saved and was not.
- Inventory valuation came from an assumed batch quantity of 20, with AVCO as FIFO × 0.96.
- Projects rendered milestones, time logs and profitability from hard-coded arrays keyed to invented
  project ids.

**The BFF routes those components fetched do not exist.** `apps/web/src/app/api` has three route
handlers, all file downloads. So the fallback branch was never an edge case — it was the only path
ever taken, exactly as it had been for statements.

Valuation, low-stock alerts, milestones, time logs, profitability and the CRM activity feed were
**removed rather than repaired**: none has a table behind it. `InventoryItem` has no
quantity-on-hand column and there is no stock ledger; there is no milestone, time-entry, or expense
table; there is no activity or audit-event table these surfaces could read. Each surface now states
what it cannot show yet. Lead conversion and opportunity stage moved to server actions
(`convertLeadAction`, `updateOpportunityStageAction`) and now persist, with the board rolling back
on failure.

**Pricing.** `PricingPlan.features` accepts `{ label, beta: true }`. "Customer statements & ledger
views" is marked beta in Starter, with a note defining what beta means. The marker comes off when
deployed-data evidence exists, not before.

**MMF-2 — "Money you owe suppliers."** Defined in `docs/mmf.md` with nine acceptance criteria, then
built: `payables.service.ts` reusing the pure rules in `ageing.ts`,
`GET /businesses/:businessId/statements/payables`, contract schemas, a server-rendered
`/b/[businessId]/payables` page, and a "Bills to Pay" nav entry. 8 tests covering B1–B8.

## Decisions and trade-offs

- **Kept a stop condition despite full authority.** The owner granted destructive database and
  credential operations. Authority makes those permitted; it does not make them reversible. The
  policy therefore requires a _tested_ recovery path rather than a human signature — the intent (no
  blocking, no waiting) is preserved and the property that cannot be recovered is not.
- **Removed unbackable features instead of leaving them behind a flag.** A flag still implies the
  capability exists. Stock valuation cannot be computed from data bizOS does not store, and saying
  so is more useful to a business than a toggle that reveals invented numbers.
- **MMF-2 states the all-or-nothing limitation on the surface.** bizOS records no outbound payment,
  so a supplier bill is outstanding in full or settled in full. `partialSettlementSupported: false`
  is in the contract so the surface has to carry the caveat rather than implying the totals net
  part-payments. Inventing a partial settlement to make the figure look precise is the exact failure
  test 4 exists to catch.
- **Did not build the missing BFF routes.** Four modules' worth of write paths is its own slice, and
  bundling it here would have made this change unreviewable. The honest failure state ships now; the
  routes are a follow-up.

## Verification

Run in the working tree, `NODE_ENV` unset.

```text
pnpm check                                              # passed, exit 0 (final run)
pnpm test --force                                       # passed, uncached, 18/18 tasks
pnpm --filter @bizo/api exec vitest run src/statements/ # passed, 37 tests, 3 files
pnpm agent:verify                                       # passed after pnpm graph
pnpm docs:check                                         # passed, all local links resolve
git apply --check --reverse mmf-1-...patch              # passed before the patch was deleted
```

`pnpm check` was re-run with `--force` after reporting `FULL TURBO`, to confirm the suite executed
against these files rather than replaying a cache hit.

Not run: the Playwright e2e suite, and anything requiring PostgreSQL, Redis, or SMTP.

Not verified: behaviour against real data in a deployed environment — for MMF-1 or MMF-2. Both are
proven as logic against mocked rows. Nothing was deployed this session.

## Follow-ups

- **The missing BFF write paths.** Inventory, projects and credit notes have working NestJS
  endpoints and no route or server action reaching them, so their create forms now fail honestly
  instead of lying. Each needs a server action following the `createLeadAction` pattern.
- **MMF-2 claim readiness.** Not on the pricing page at all yet. When it goes up it goes up as beta,
  under the mechanism added this session.
- **Deployed-data evidence for MMF-1 and MMF-2**, recorded in
  [invoice-vertical-slice-production-evidence.md](../operations/invoice-vertical-slice-production-evidence.md).
  This is what removes both beta markers.
- **Outbound supplier payments**, which is what makes partial settlement representable and unlocks a
  real supplier account statement.
- `formatMoney(..., "USD", 2)` is still hardcoded in several web surfaces in a product whose launch
  markets are SAR, AED and INR. Same family as the `customer.currencyCode ?? "USD"` bug MMF-1
  removed. Worth one pass.
- "ZATCA & country compliance packs" is sold on the Growth plan. Not audited this session — it
  should be checked against what actually ships, and marked beta if the evidence is not there.
- ADR-0023 and ADR-0024 are still `Proposed`. Accepting them is now within agent authority but they
  deserve a deliberate read rather than a rubber stamp.

## Handoff notes

- `AGENTS.md` is the contract now. Read the reversibility tiers before any production or database
  work; the tier decides what you owe before you act, not whether you may act.
- The fabricated-data pattern is gone from `apps/web/src` — a repo-wide grep for `mock`,
  `fallback local`, and baseline-if-empty returns nothing outside test files. If it reappears, it
  will reappear as "just a placeholder until the endpoint lands", which is how every instance of it
  started.
- `ageing.ts` is pure and now serves both receivables and payables. Test bucket rules there, not
  through either service.
- `payables.service.ts` deliberately does not share `load()` with `statements.service.ts`: that
  helper resolves payment and credit-note allocations, and payables has neither. Merging them would
  have meant a settlement path that is always empty, which is how a fake partial settlement would
  get introduced later.
- No claim was taken with `pnpm agent:claim`; this was a single-agent session against the working
  tree. Claim first if another agent may be active.
- Nothing was pushed. `main` is local, six commits ahead of `0025523`.
