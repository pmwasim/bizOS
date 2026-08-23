# Complete bizOS production release and clear E2E gate

Date: 2026-08-23

Agent: codex-production-20260823

Scope: e2e

Status: In progress

Related:
[Repair recurring production health false failures](2026-08-23-repair-recurring-production-health-false-failures.md);
PR #120

## Context

PR #120 contained the production-health workflow repair, but its required Quality gate was blocked
by eight E2E failures. The failures all waited for the removed `Let’s send your first quotation`
heading after default setup. The current dashboard contract is `Welcome to your new workspace`. The
worktree also contains unrelated zero-budget AI, agent metadata, and documentation changes; those
were preserved and are not part of this change.

## What changed

Updated the E2E setup helper and smoke journeys to follow the current dashboard UI:

- `e2e/helpers.ts` now asserts `Welcome to your new workspace` after `Use default`.
- `e2e/quotation-journey.spec.ts`, `e2e/po-approval-readiness.spec.ts`, and
  `e2e/prod-invoice-smoke.mjs` now target the current `Add first customer` link label.
- `.github/workflows/production-health.yml` now accepts a public-edge 403 only with the known
  Render-origin marker; other 403 responses fail the diagnostic.
- `docs/operations/monitoring.md` documents the stricter public-edge condition.
- Created this handoff journal entry.

## Decisions and trade-offs

The assertions were updated to the rendered product contract rather than restoring removed copy or
weakening the checks. The full E2E suite was run with `THROTTLE_SCALE=100` only in a non-production
test process; production keeps the strict default because the API config forces scale 1 in
production.

## Verification

Exact commands run and their real outcome. Distinguish passed, failed, and not run. A command that
was skipped because of a known pre-existing failure should say which failure.

```text
pnpm exec prettier --check e2e/helpers.ts e2e/prod-invoice-smoke.mjs  # PASS
NODE_ENV=production TURBO_ENV_MODE=loose pnpm --filter @bizo/web... build  # PASS
DATABASE_URL="$E2E_DATABASE_URL" pnpm --filter @bizo/database exec prisma migrate deploy  # PASS; 24 migrations
DATABASE_URL="$E2E_DATABASE_URL" pnpm db:seed  # PASS; seed completed
E2E_WEB_PORT=3104 E2E_API_PORT=3105 THROTTLE_SCALE=100 DATABASE_URL="$E2E_DATABASE_URL" \
  pnpm exec playwright test e2e/quotation-journey.spec.ts --project=desktop-chromium --reporter=line  # PASS; 1 passed
E2E_WEB_PORT=3106 E2E_API_PORT=3107 THROTTLE_SCALE=100 DATABASE_URL="$E2E_DATABASE_URL" \
  pnpm exec playwright test --reporter=line  # PASS; 10 passed (28.1s)
```

The earlier unscaled broad E2E run was not used as release evidence: it failed with expected
throttling pressure (7 failures, 3 passes) and also exposed the stale labels. Repository-wide
`pnpm check`, lint, and typecheck remain blocked by pre-existing unrelated dirty AI/memory files;
they were not modified or hidden in this work.

## Follow-ups

PR #120 needs the hosted required checks to rerun on the stricter public-edge diagnostic, then merge
and production deployment/health verification must complete. The authoritative production checkout
and public ingress must be checked before claiming release completion.

## Handoff notes

The scratch database is `bizo_e2e`; it was created and migrated on the local PostgreSQL container.
Use scratch ports and `THROTTLE_SCALE` only outside production. Do not stage the unrelated AI and
agent metadata changes in this worktree. The current claim remains active until PR and production
verification finish.
