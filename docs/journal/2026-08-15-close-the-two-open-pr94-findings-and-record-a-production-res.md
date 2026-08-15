# Close the two open PR94 findings and record a production restart I caused

Date: 2026-08-15

Agent: claude-cowork

Scope: apps/web/src

Status: Complete

Related: PR #95, PR #94,
`2026-08-15-restore-the-module-pages-behind-dead-sidebar-links-and-clear.md`

## Context

My connection to this host dropped mid-edit while I was working through six review findings on PR
#94. By the time it came back, #94 had merged, all thirteen Dependabot PRs had merged, and another
agent had landed the payment over-allocation fix and a public pricing page. `main` had moved
eighteen commits.

Four of the six findings had been fixed before #94 merged. Two had not, and both were live on
`main`.

## What changed

### Sales-order tax ignored business settings (PR #95)

`newLine()` and the initial line in `sales-order-form.tsx` both hardcoded `taxRatePercent: "15"`.
Whatever the line carries is what `calculateDocumentTotals` uses server-side, so every business with
tax disabled or on a rate other than 15% got the wrong tax and total unless the user corrected each
line by hand. The rate now comes from `BusinessSettings`, the way `quotations/new` already gets it.

### Confirm and cancel were unreachable

`SalesOrderActions` was defined and rendered nowhere — a repo-wide search found only its own
definition. A new order is a `DRAFT` and its detail page is the only destination the UI offers, so
`POST :salesOrderId/confirm` and `/cancel` could not be reached from a browser at all. Now rendered
on the detail page.

`e2e/sales-order-lifecycle.spec.ts` covers both: it asserts the new line carries the business's
configured rate, creates the order, confirms it, and checks the buttons swap. The API log for the
run shows `POST /sales-orders` → 201, `POST /sales-orders/:id/confirm` → 201, and the detail refetch
reporting `CONFIRMED`.

### A local-only test collision, fixed properly

`quotation-journey.integration.spec.ts` used fixed emails, so a second run against a persistent
local database failed on the users unique constraint. CI gets a fresh database each time and never
saw it. Scoped to a run id, matching `phase1-modules-journey`. The API suite now passes 707/707
twice in a row against the same database, which is the point.

## I restarted production by accident

While clearing stale test servers I ran `pkill -f "next-server"`. Next names its process
`next-server (v16...)` **including the standalone production server**, so the pattern matched
`bizos-web` and killed it.

`Restart=always` brought it back in about five seconds. Verified immediately afterwards: both units
active, `https://bizos.qloudihub.com/` 200, `pnpm ops:release-readiness` 8/8. No data was touched
and no deploy was in flight, so the blast radius was a few seconds of 502s.

Two things made this worse than it needed to be, and both are worth fixing rather than just being
more careful:

- Production and the test stack run on the same host, so any process-name pattern is ambiguous.
- I used a pattern kill where I had the exact PIDs available. `kill <pid>` on the scratch server
  afterwards did exactly the right thing with no ambiguity.

## Decisions and trade-offs

**Re-oriented before editing rather than replaying my in-flight work.** `main` had moved eighteen
commits and another agent was active. Four of my six findings were already fixed, and blindly
re-applying my local edits would have reverted their work. Checking each finding against current
`main` first cost a few minutes and avoided that entirely — this is what the claim-and-journal
protocol is for, and it earned its keep here.

**Fixed the integration-spec email collision instead of resetting the scratch database again.** I
had already worked around it twice this session. It is three lines, and the workaround has to be
repeated by every agent who runs the integration suites locally.

## Verification

```text
pnpm lint                                    pass
pnpm typecheck                               18/18 tasks
pnpm format:check                            pass
pnpm --filter @bizo/api test                 707 passed (64 files), run twice back to back
                                             against the same database
playwright e2e/sales-order-lifecycle.spec.ts 1 passed
playwright e2e/phase1-navigation.spec.ts     1 passed
production after the accidental restart      units active, site 200, release-readiness 8/8
```

Everything ran on `ubuntu-ms-7978`. The other desktop, `nash-ms-7e02`, is being retired and was not
touched at any point in this session.

## Follow-ups

- **PR #95 is armed for auto-merge, not merged.** The tax and status-UI fixes are not in production
  until it lands and is deployed.
- **`pkill` on this host is dangerous** while production and the test stack share it. Worth a line
  in AGENTS.md's gotchas: kill scratch servers by PID, never by process-name pattern, because the
  standalone production server also matches `next-server`.
- **Three module headings still do not match their nav labels** ("Projects & Profitability Summary",
  "Inventory & Stock Engine", "Credit Notes & Adjustments").
- **`/opportunities` still has no nav entry** — the `crm` module maps to `/leads` only.
- Everything from the branch-audit entry stands: `valid_until` should not be NOT NULL for
  non-quotation documents, the `as unknown as` casts defeat type checking, ADR-0022 is used twice,
  and Prisma Compute Deploy fails on every PR without being required.

## Handoff notes

Claims released.

- Another agent is active in this repository. Check `pnpm agent:status` and the last few journal
  entries before starting; `main` moved eighteen commits during a single disconnection.
- Local e2e: `E2E_WEB_PORT=3998 E2E_API_PORT=3999` with `DATABASE_URL` on `bizo_e2e`, migrated
  **and** seeded. Kill leftover servers by PID — `reuseExistingServer` silently reuses a stale one
  and the failures look like product bugs (two specs failed at `/start` for exactly this reason
  before I noticed).
