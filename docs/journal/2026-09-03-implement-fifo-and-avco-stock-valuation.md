# Implement FIFO and AVCO stock valuation

Date: 2026-09-03

Agent: jim

Scope: apps/api, packages/contracts, docs/decisions

Status: Complete

Related: [ADR-0029](../decisions/0029-stock-valuation-method.md)

## Context

TASK-31 was merged to `main` at `5ea9507`; this task reintroduced the removed in-memory stock
valuation as a persisted read model over `StockMovement` rows. Work started in fresh worktree
`/home/wasim/bizo-task32` on `sprint8-task32` from `origin/main`.

## What changed

Implemented `InventoryService.valuation` and
`GET /api/v1/businesses/:businessId/inventory/stock/valuation` with optional location and FIFO/AVCO
selection (FIFO default). The service replays movements ordered by `(occurredAt, id)`, uses BigInt
for all money arithmetic, supports signed adjustments/transfers, clamps historical outbound
overages, and returns minor-unit money as strings. A zero-cost positive adjustment inherits the
current method valuation; a zero-cost inbound transfer inherits the source location's valuation at
transfer time.

Added `StockValuation` contracts and query validation in `packages/contracts/src/inventory.ts`.
Added unit coverage and a real-PostgreSQL journey covering FIFO, AVCO, signed adjustments,
transfer-at-cost, and non-terminating AVCO average rounding. Added and accepted ADR-0029 and indexed
this journal entry.

## Decisions and trade-offs

ADR-0029 records the approved read-time replay design. AVCO retains an exact rational numerator and
denominator and applies round-half-up only when rendering the average unit cost; asset value remains
the exact integer minor-unit total. No materialized table or movement write-path redesign was added.
Michael (god) approved the ADR after the transfer-at-cost and rounding policies were made explicit.

## Verification

Exact commands run and their real outcome. Distinguish passed, failed, and not run. A command that
was skipped because of a known pre-existing failure should say which failure.

```text
pnpm install --frozen-lockfile                                      # passed
pnpm --filter @bizo/authorization --filter @bizo/config --filter @bizo/contracts --filter @bizo/database --filter @bizo/queue --filter @bizo/storage --filter @bizo/ui build # passed
pnpm --filter @bizo/api run typecheck                              # passed
pnpm --filter @bizo/api exec vitest run src/inventory/inventory.service.spec.ts # 15 passed
pnpm --filter @bizo/api test                                       # 987 passed, 75 skipped
pnpm --filter @bizo/api exec eslint src/inventory/inventory.service.ts src/inventory/inventory.service.spec.ts src/inventory/inventory.controller.ts src/integration/phase1-modules-journey.integration.spec.ts # passed
pnpm --filter @bizo/database prisma:validate                       # passed
pnpm security:audit                                                # passed, no known vulnerabilities
DATABASE_URL="$task32_database_url" RUN_DATABASE_TESTS=true pnpm --filter @bizo/api exec vitest run src/integration/phase1-modules-journey.integration.spec.ts # 11 passed
```

The first integration attempt was intentionally retried after seeding the disposable database's
published `default-erp` configuration; no application defect was indicated. The disposable
`bizo_task32` database was used only for this verification.

## Follow-ups

None.

## Handoff notes

The worktree contains generated `.agent` metadata from graph checks; it is deliberately excluded
from the code PR. The valuation endpoint is read-only and relies on the append-only ledger. Claim
`clm_35ca8614` should be released after the PR is handed off.
