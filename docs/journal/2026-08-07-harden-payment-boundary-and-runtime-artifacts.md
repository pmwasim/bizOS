# Harden payment boundary and runtime artifact handling

Date: 2026-08-07

Agent: chatgpt-gpt-5.6-thinking

Scope: apps/api/src/payments, packages/contracts/src/payments.ts, apps/api/.data, .gitignore, package.json, scripts/check-tracked-runtime-artifacts.mjs

Status: In progress — GitHub CI pending

Related: [2026-08-06 — Module 7 Payment Recording](./2026-08-06-module-7-payment-recording.md)

## Context

A targeted repository review found that the payment service resolved business membership but
intentionally skipped the existing Casbin-backed `assertAllowed` policy check. The payment contract
also accepted fractional minor-unit values and ambiguous allocation targets. Separately, six
runtime-generated PDF files under `apps/api/.data/object-store` were tracked in the public
repository.

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

## Decisions and trade-offs

- Existing role permissions were not changed. This work enforces the policy already defined in
  `BusinessAccessService` rather than inventing new product authorization rules.
- Payments are restricted to the business base currency because the current data model exposes one
  business currency scale and no governed multi-currency conversion path.
- This change validates that allocations do not exceed a single payment amount. It does not yet
  prevent cumulative completed allocations across several payments from exceeding a target
  document balance; that requires target-balance transaction logic and dedicated acceptance tests.
- Runtime files are removed from future repository trees, but Git history was not rewritten. History
  rewriting and force-pushing are destructive operations reserved for explicit human authorization.

## Verification

The connected GitHub environment could read and write repository files but could not clone the
repository or execute local commands because outbound DNS access was unavailable. The branch diff
was reviewed through the GitHub compare API.

```text
pnpm format:check                              # not run locally; GitHub CI pending
pnpm --filter @bizo/contracts test             # not run locally; GitHub CI pending
pnpm --filter @bizo/api test                   # not run locally; GitHub CI pending
pnpm typecheck                                 # not run locally; GitHub CI pending
pnpm check                                     # not run locally; GitHub CI pending
pnpm test:e2e                                  # not run locally; GitHub CI pending
GitHub compare main...agent/harden-payment-boundary  # inspected; 13 commits, intended files only
```

## Follow-ups

1. **Release blocker:** wait for the full CI quality and Playwright gates; fix failures before marking
   the pull request ready.
2. Run `pnpm graph` and `pnpm journal:index`, then commit generated changes. The connector-only
   environment could not execute those repository generators.
3. Inspect historical PDFs for personal, customer, tax, signature, or financial information. With
   explicit authorization, use `git filter-repo` to purge affected paths from all history and
   force-update protected refs in a controlled maintenance window.
4. Add transaction-safe cumulative allocation checks so completed payments cannot overpay an
   invoice or other target across multiple payment records.
5. Define and test whether `STAFF`, `ACCOUNTANT`, and other roles should create, complete, or reverse
   payments; this change intentionally preserves the existing policy table.

## Handoff notes

The working branch is `agent/harden-payment-boundary`. Do not merge until CI passes and generated
agent graph/journal index files are refreshed. The branch removes current-tree runtime artifacts but
not their historical blobs. No production deployment, merge, secret handling, or destructive Git
operation was performed.
