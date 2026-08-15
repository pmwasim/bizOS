# Branch audit: recover unmerged phase-1 work and fix three broken document write paths

Date: 2026-08-15

Agent: claude-cowork

Scope: apps/api/src

Status: Complete

Related: PR #83, PR #84, PR #37, issue #60,
`2026-08-15-merge-pr81-and-cut-production-over-to-the-production-build.md`

## Context

An audit of every branch, local and remote, after PR #81 merged and production was cut over. The
audit itself was routine; what it found was not.

## What changed

### Branch inventory

Seventeen remote branches, two local, four tags, one stash. Every non-Dependabot remote branch was
checked for whether its distinguishing content is present on `main` — ancestry alone is unreliable
because `main` uses squash merges.

Deleted, all with closed PRs and content verified present on `main`:

| Branch                                    | PR  | Where the content went                                  |
| ----------------------------------------- | --- | ------------------------------------------------------- |
| `cursor/customer-payment-allocation-ccc4` | #34 | merged locally 2026-08-14, then into the #81 squash     |
| `cursor/secure-client-ip-forwarding-ccc4` | #38 | same; `isTrustedForwardedIp` and `perAccount` on `main` |
| `fix/production-auth-route-smoke`         | #57 | superseded by #67, merged                               |
| `fix/signin-route-build`                  | #63 | superseded by #64, merged                               |

`cursor/release-version-endpoint-ccc4` (PR #37) was the only live remote branch. Ten Dependabot
branches remain.

### The local-only branch nobody had merged

`fix/brace-expansion-override` exists **only on this desktop** — its remote was deleted when PR #54
merged, but the local branch carried on and now holds ten commits that never reached `main`,
including `test(api): add coverage for the 8 phase-1 services, fix a fifth runtime bug`.

Bundled to `/home/wasim/bizos-backups/phase1-local-branch-20260815.bundle` before anything else, and
the stash to `stash0-20260815.patch`. **It must not be pushed**: its tree contains six real PDFs
under `apps/api/.data/object-store/` with production tenant and business identifiers in the paths —
the repository is public, and this is the material issue #60 is about.

What it holds that `main` lacks:

- service specs for `leads`, `opportunities`, `delivery-notes`, `projects`, and a
  `phase1-modules-journey.integration.spec.ts` that drives all eight phase-1 services through real
  Postgres;
- about twenty web pages and forms — list and "new" routes for suppliers, sales orders, leads,
  opportunities, delivery notes, and "new" routes for projects, inventory, credit notes;
- `apps/web/src/app/global-error.tsx`, `docs/prd.md`, five journal entries, `deploy-local.sh`;
- an ADR numbered 0022 for a Cloudflare Workers hosting split, colliding with `main`'s ADR-0022
  (Ubuntu production hosting).

### Three write paths that could not reach the database (PR #83, merged)

Restoring the four service specs took an hour. Restoring the integration spec found real defects in
under a minute.

**`valid_until` was never set.** `documents` is shared with quotations, so `valid_until` is NOT NULL
with no default. `SalesOrdersService.create`, `CreditNotesService.create` and
`DeliveryNotesService.create` all omitted it. Confirmed by direct insert:

```text
ERROR:  null value in column "valid_until" of relation "documents" violates not-null constraint
```

**`settings.currencyScale` was always `undefined`.** `currencyScale` is a column on `businesses`;
`business_settings` has no currency column at all — `information_schema` returns zero rows for
`%currency%` on that table. All three services read it off `settings`. That is a second NOT NULL
violation, and in credit notes and sales orders the same undefined value was passed to
`calculateDocumentTotals` as the money scale.

**Cancelling a sales order violated a check constraint.** `documents_archive_consistency_check`
requires `status` and `archived_at` to move together; `SalesOrdersService.cancel` set only the
status. `InvoicesService.archive` already set both. The integration suite found this on its first
run.

The last sales order, credit note and delivery note in production were all created on 2026-08-07 —
by the unmerged branch's working code. Nothing has been creatable since.

A review then caught a fourth, in my own fix: `documents_dates_check` is
`CHECK (valid_until >= issue_date)`, so taking the synthetic value from `deliveryDate` rejected a
backdated delivery note and any sales order whose delivery date precedes its issue date. Both now
use the issue date, with integration cases covering it.

### Dependabot (PR #84)

#68 and #69 bumped the Docker base image to node 26 against an `engines` range of `>=22.13 <25`.
Both had been red since 2026-08-09. Closed, and both Docker ecosystems now ignore
`versions: [">=25"]` — not every major, which would also have suppressed the legitimate 22 → 24
move.

### PR #37 rebuilt

Open since 2026-07-28. The branch was cut before ADR-0022 retired the Render path, so merging it
would have restored `.github/workflows/production-deploy.yml` — 473 lines of a deployment route that
no longer exists. Rebuilt on current `main` with only the five files the feature needs, keeping
`THROTTLE_SCALE`, `CLIENT_IP_SIGNATURE_SECRET` and `APP_BASE_URL` in the config schema.
`containers.yml` now passes `GIT_SHA` and `BUILD_TIME` as build args, with the timestamp computed in
a step rather than read from `github.event.repository.updated_at` — the API validates it as an ISO
datetime at boot, so an empty value would stop the service starting.

## Decisions and trade-offs

**Why the suite was green while three write paths were broken.** Two causes, both worth naming. The
unit mocks put `currencyScale` inside `settings` — they encoded the bug, so the assertion could
never fail. And these services cast every Prisma result through `as unknown as <LocalInterface>`,
which defeats structural checking of `include`/`data` shapes against the generated client, so a
wrong field or relation name compiles and typechecks cleanly. The recovered integration spec says
this in its own header comment; it was written by whoever hit the same wall on 2026-08-07.

**Fixed the mocks rather than only the services.** A mock that mirrors the bug is worse than no
mock. Both now match the real Prisma shape, and a new assertion pins every NOT NULL column the
shared `documents` table requires.

**Populated `valid_until` rather than making it nullable.** The column only means something for
quotations, and modelling it that way would be cleaner. It is also a shared-table migration plus
null-handling across every quotation and invoice read, which is the wrong risk this week. Recorded
as a follow-up.

**Did not push the local-only branch.** Its history contains customer PDFs and the repository is
public. Recovery is file-by-file onto clean branches.

## Verification

```text
pnpm lint                                    pass
pnpm --filter @bizo/api exec tsc --noEmit    pass
pnpm --filter @bizo/api test                 703 passed (64 files) on a fresh migrated + seeded
                                             database, RUN_DATABASE_TESTS=true RUN_REDIS_TESTS=true
PR #83 CI                                    all five required checks pass; squash-merged as 37bf9b2
production after deploy                      pnpm ops:release-readiness → 8/8
```

Direct database evidence for each defect is quoted above; all of it was gathered against the scratch
`bizo_e2e` database or read-only against production.

A note for anyone re-running the integration suites locally: `quotation-journey.integration.spec.ts`
uses fixed emails (`owner@example.test`), so a second run against a persistent database fails on the
unique constraint. `phase1-modules-journey` scopes its emails with a run id and does not.
`pnpm db:seed` is required — an unseeded database fails 46 tests.

## Follow-ups

- **Recover the phase-1 web routes.** `main` has detail pages for suppliers and sales orders but no
  list or "new" routes, and nothing at all for leads, opportunities or delivery notes. Those pages
  exist on the local bundle. Users can reach a supplier detail page only by typing the URL.
- **Issue #60 has a second location.** The audit found production PDFs committed in the local
  branch's tree, not only in the object store. Purge the bundle or scrub the paths before that
  branch is ever pushed.
- **`valid_until` should not be NOT NULL for non-quotation documents.** Today three services write a
  synthetic value to satisfy a constraint that does not describe them.
- **The `as unknown as` casts across the phase-1 services** are what let all of this compile. Typing
  those results against the generated client would have caught every one at build time.
- **ADR-0022 is used twice** — Ubuntu production hosting on `main`, Cloudflare Workers hosting split
  on the local branch. If that spike is ever revived it needs a new number.
- Prisma Compute Deploy still fails on every PR and is still not a required check.

## Handoff notes

No claim held; released before committing.

- Production runs `main` at `37bf9b2`, verified 8/8.
- The only local-only work of value is
  `/home/wasim/bizos-backups/phase1-local-branch-20260815.bundle`. Restore from it with `git bundle`
  and cherry-pick files; never push the branch itself.
- Open PRs: #84 (Dependabot ignore rule) and #37 (build metadata on /health), both rebased onto
  current `main` and waiting on CI. Ten Dependabot PRs remain; each needs a rebase before it can
  merge, since branch protection requires branches to be up to date.
