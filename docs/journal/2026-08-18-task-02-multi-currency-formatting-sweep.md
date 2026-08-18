# TASK-02 multi-currency formatting sweep

Date: 2026-08-18

Agent: oscar

Scope: apps/web/src

Status: Complete

Related: TASK-02 from god; previous journal follow-up noted the remaining hardcoded USD formatting.

## Context

The web app still had hardcoded USD formatting in inventory, product, project, CRM, credit-note, and
opportunity views. Several of those records do not carry currency metadata, so the task was to
source their display currency and scale from the business settings endpoint. The work was done in
the `agent/worker-oscar` worktree on the TASK-02 scope.

## What changed

- Removed the USD default from `formatMinor`; callers now provide an explicit currency and scale.
- Product and opportunity list pages fetch `BusinessSettings` and use tenant `baseCurrency` plus
  `currencyScale` when their records have no currency.
- Inventory and project pages fetch tenant settings and pass them into their client views. Project
  rows prefer `project.currencyCode` and fall back to tenant `baseCurrency`.
- CRM receives tenant currency/scale. Individual leads/opportunities prefer their document currency;
  Kanban stage totals are grouped by currency before formatting, so mixed currencies are not added
  together and labeled as one currency.
- Credit-note totals are grouped by each note's `currencyCode` and `currencyScale`, with tenant
  settings used only for the empty-state zero total.
- No hardcoded USD remains beside `formatMoney` or `formatMinor` in `apps/web/src`.

## Decisions and trade-offs

Tenant settings are the source of truth for entities whose contracts do not persist currency
(products and inventory), while document currency wins where it exists. Aggregate UI totals are
grouped by currency rather than performing cross-currency arithmetic; this keeps the formatting
sweep from presenting a misleading amount. No durable architecture change or ADR was needed.

## Verification

Exact commands run and their real outcome. Distinguish passed, failed, and not run. A command that
was skipped because of a known pre-existing failure should say which failure.

```text
pnpm --filter @bizo/contracts build             # passed
pnpm --filter @bizo/config build                # passed
pnpm --filter @bizo/web typecheck               # passed
pnpm --filter @bizo/web lint                    # passed (exit 0; existing Pages-directory warning)
pnpm --filter @bizo/web test                    # passed, 6 files / 38 tests
pnpm exec prettier --check <changed web files>   # passed
git diff --check                                 # passed
rg -n 'formatMoney|formatMinor' apps/web/src | rg USD  # no matches
```

## Follow-ups

No formatting call sites remain with a hardcoded USD value. CRM and credit-note aggregate labels now
show multiple formatted values when records contain multiple currencies. Currency scale for CRM
records remains the tenant setting because those contracts carry no per-record scale.

## Handoff notes

Changes are committed on the `agent/worker-oscar` branch. The `apps/web/src` claim must be released
after handoff. The first standalone web typecheck failed only because workspace declaration output
was absent; building `@bizo/contracts` and `@bizo/config` fixed that prerequisite. No accounting
math or API contracts were changed.
