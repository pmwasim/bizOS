# Complete RevenueCat paywall publish and server entitlements

Date: 2026-08-21

Agent: cursor-ship

Scope: apps/api, apps/web, packages/config, packages/contracts

Status: Ready for review

Related: [Integrate RevenueCat Web SDK](2026-08-21-integrate-revenuecat-web-sdk-for-qloudi-pro.md),
[Public sales readiness](2026-08-21-public-sales-readiness-for-bizos-qloudihub-com.md)

## Context

Sales readiness shipped client-side RevenueCat Web Billing on `/subscribe`. Admin follow-ups still
needed server-side entitlement checks so feature gates do not trust the browser alone. Incomplete
WIP from `cursor-rc-continue` was reviewed, fixed (restored keep-warm production env test), and
shipped.

## What changed

- `packages/contracts` — `billing` schemas + `QLOUDI_PRO_ENTITLEMENT_ID`; export map entry.
- `packages/config` — optional `REVENUECAT_API_KEY`; turbo env allowlists; `.env.example` docs.
- `apps/api` — `BillingModule` with RevenueCat subscriber client, `GET /billing/entitlements`,
  `BillingService.assertQloudiPro` for fail-closed feature gates.
- `apps/web` — BFF `GET /api/billing/entitlements` proxying the API with the session assertion.

## Decisions and trade-offs

- Unset `REVENUECAT_API_KEY` returns `configured: false` without failing API boot (local/dev safe).
- `assertQloudiPro` fails closed with 503 when unconfigured and 403 when the entitlement is missing.
- Paywall publish left for explicit Admin action (MCP `publish-paywall` is gated).

## Verification

```text
pnpm --filter @bizo/contracts test
pnpm --filter @bizo/config test
pnpm --filter @bizo/api exec vitest run src/billing
pnpm --filter @bizo/api typecheck
pnpm --filter @bizo/web typecheck
```

## Follow-ups

- Set `REVENUECAT_API_KEY` on production API env (prefer `sk_…`).
- Publish paywall `pw69c72316840643c8` when ready for `presentPaywall`.
- Call `assertQloudiPro` from specific Pro-gated handlers as those land.

## Handoff notes

Claim held by `cursor-ship`. Dual claims from `cursor-rc-continue` were released before this ship.
