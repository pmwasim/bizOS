# Harden payment boundary and runtime artifact handling

Date: 2026-08-07

Agent: chatgpt-gpt-5.6-thinking

Scope: apps/api/src/payments, packages/contracts/src/payments.ts, apps/api/.data, .gitignore,
package.json, pnpm-workspace.yaml, pnpm-lock.yaml, scripts/check-tracked-runtime-artifacts.mjs

Status: Complete — GitHub CI verified

Related: [2026-08-06 — Module 7 Payment Recording](./2026-08-06-module-7-payment-recording.md)

## Context

A targeted repository review found that the payment service resolved business membership but
intentionally skipped the existing Casbin-backed `assertAllowed` policy check. The payment contract
also accepted fractional minor-unit values and ambiguous allocation targets. Separately, six
runtime-generated PDF files under `apps/api/.data/object-store` were tracked in the public
repository.

During validation, the dependency audit also identified patched `js-yaml` releases that were not yet
selected by the lockfile.

## What changed

- Restored `BusinessAccessService.assertAllowed` enforcement for payment create, read, update,
  completion, and reversal paths.
- Added payment contract validation requiring positive integer minor-unit amounts and exactly one
  target per allocation.
- Added a service invariant preventing allocations from exceeding the payment amount.
- Replaced the hard-coded payment currency scale with the selected business's configured base
  currency and scale; unsupported currency mismatches are rejected.
- Added contract and service tests covering authorization, currency scale, invalid minor-unit
  values, ambiguous allocation targets, and over-allocation within one payment.
- Removed six tracked runtime PDFs from the branch and ignored `apps/api/.data/`.
- Added `scripts/check-tracked-runtime-artifacts.mjs` and included it in `pnpm check` so tracked
  runtime object-store files fail the quality gate.
- Added major-version-safe `js-yaml` overrides for `3.15.1` and `4.3.1`, regenerated the lockfile,
  and preserved the repository's minimum-release-age policy with explicit security-fix exclusions.

## Decisions and trade-offs

- Existing role permissions were not changed. This work enforces the policy already defined in
  `BusinessAccessService` rather than inventing new product authorization rules.
- Payments are restricted to the business base currency because the current data model exposes one
  business currency scale and no governed multi-currency conversion path.
- This change validates that allocations do not exceed a single payment amount. It does not yet
  prevent cumulative completed allocations across several payments from exceeding a target document
  balance; that requires target-balance transaction logic and dedicated acceptance tests.
- Dependency overrides remain within each `js-yaml` major line rather than forcing CommonJS and ESM
  consumers across incompatible major versions.
- Runtime files are removed from future repository trees, but Git history was not rewritten. History
  rewriting and force-pushing are destructive operations reserved for explicit human authorization.

## Verification

GitHub Actions validated the final implementation at branch head `c85b367831850a69a17feaa198dbd9bac2486f92`.

```text
Dependency review run 31132221588       # passed
CodeQL run 31132221591                  # passed — TypeScript analysis
Container build run 31132221600         # passed — API image and web image
CI run 31132221613                      # passed
  dependency audit                      # no known vulnerabilities
  database migrations                   # all 10 applied; schema up to date
  pnpm check                            # passed
    format and documentation links      # passed
    tracked runtime artifact guard      # passed
    local service security checks       # passed
    lint and TypeScript                  # passed
    unit and integration tests          # passed
    Prisma validation and builds        # passed
  Playwright desktop/mobile journeys    # passed
```

The connected environment could not clone the repository because outbound DNS access was unavailable,
so GitHub Actions was used as the independent executable validation environment. Temporary
branch-only workflows were used to regenerate the lockfile and apply the repository's pinned
Prettier version; both temporary workflows were removed after their commits landed.

## Follow-ups

1. Inspect historical PDFs for personal, customer, tax, signature, or financial information. With
   explicit authorization, use `git filter-repo` to purge affected paths from all history and
   force-update protected refs in a controlled maintenance window.
2. Add transaction-safe cumulative allocation checks so completed payments cannot overpay an invoice
   or other target across multiple payment records.
3. Define and test whether `STAFF`, `ACCOUNTANT`, and other roles should create, complete, or reverse
   payments; this change intentionally preserves the existing policy table.
4. Add document-currency checks when target documents can differ from the business base currency or
   when governed multi-currency support is introduced.

## Handoff notes

The working branch is `agent/harden-payment-boundary`, tracked by draft pull request #55. The branch
removes current-tree runtime artifacts but not their historical blobs. No production deployment,
merge, secret handling, or destructive Git operation was performed. Human review and merge approval
remain required.
