# Deploy OpenAPI billing and deps to production

Date: 2026-08-21

Agent: cursor-autonomy

Scope: apps/api, apps/web, docs/journal

Status: Ready for review

Related:
[Complete RevenueCat server entitlements](2026-08-21-complete-revenuecat-paywall-publish-and-server-entitlements.md),
[Public sales readiness](2026-08-21-public-sales-readiness-for-bizos-qloudihub-com.md), PRs #112
#115 #116

## Context

Production was still on `1434826` (sales-readiness only) while `main` had advanced through
RevenueCat server entitlements (#115), OpenAPI docs (#112), and AWS/CodeQL dependency bumps.
Continuing autonomous ops to bring production current.

## What changed

- `/home/wasim/bizos-production` fast-forwarded `1434826` → `c64de5c`.
- No pending migrations. API + web production builds rebuilt; `bizos-api` and `bizos-web` restarted.
- `REVENUECAT_API_KEY` already present in production `.env` (Test Store key; read-only subscriber
  lookups). Paywall `pw69c72316840643c8` is published in RevenueCat.
- Rollback SHA if needed: `1434826` (previous production pin).

## Decisions and trade-offs

- Did not force-merge Dependabot `@changesets/cli` 3.0.0 (#100): major bump with failing quality
  gate; left open with a review note.

## Verification

```text
pnpm ops:release-readiness   # passed — 14/14 (retry after brief post-restart fetch flake)
curl localhost:3001/docs     # 200
curl localhost:3001/api/v1/docs/openapi.json  # 200
curl localhost:3001/api/v1/billing/entitlements  # 401 unauthenticated (expected)
https://bizos.qloudihub.com/ + /subscribe  # 200
```

## Follow-ups

- Connect RevenueCat Billing / Stripe for real card checkout (still Test Store only).
- Prefer a secret `sk_…` for `REVENUECAT_API_KEY` when available.
- Wire `assertQloudiPro` onto specific Pro-gated API handlers as those features ship.
- Dependabot #100 (`@changesets/cli` 3.x) needs a dedicated breaking-change review.

## Handoff notes

Claim `clm_4e2ced60` held by `cursor-autonomy` during this deploy; release on journal commit.
Production compose Postgres/Redis were already healthy from the prior restore.
