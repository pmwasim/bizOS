# Integrate RevenueCat Web SDK for Qloudi Pro

Date: 2026-08-21

Agent: cursor-rc-web

Scope: apps/web, packages/config

Status: Done

Related: none (new commercial slice)

## Context

RevenueCat project `projfc47935f` (bizOS) already had Test Store products (`monthly`, `yearly`,
`lifetime`), packages (`$rc_monthly`, `$rc_annual`, `$rc_lifetime`), entitlement `Qloudi Pro`, and
current offering `default`. The web app had a marketing pricing page but no Purchases SDK
integration. Request: install `@revenuecat/purchases-js`, configure with the public Test Store key,
present paywalls, check `Qloudi Pro`, and support Customer Center–style management on web.

## What changed

- Installed `@revenuecat/purchases-js@1.53.1` on `@bizo/web`.
- Added `apps/web/src/lib/revenuecat/` — configure-once client, entitlement helpers, error
  formatting, catalog constants, unit tests.
- Added `QloudiProSubscriptionPanel` + `/subscribe` page (Auth.js `user.id` as `appUserId`):
  `presentPaywall`, package `purchase()` fallback, entitlement status, Customer Portal via
  `managementURL` (`onVisitCustomerCenter` callback).
- Linked from `/pricing` and business Settings.
- CSP in `next.config.ts` allows RevenueCat + Stripe hosts required by the Web SDK / RC Billing.
- `.env.example` documents `NEXT_PUBLIC_REVENUECAT_WEB_API_KEY`; local `.env` set (gitignored).
- RevenueCat dashboard: Paywall AI draft created for offering `ofrng940605344f`
  (`pw69c72316840643c8`) — **unpublished**.

`packages/config` was claimed but not modified; the public key is client-only via `NEXT_PUBLIC_*`.

## Decisions and trade-offs

- **Customer Center on web:** SDK does not embed Customer Center. Web equivalent is RevenueCat
  Billing / Test Store Customer Portal via `CustomerInfo.managementURL`, wired through
  `onVisitCustomerCenter` and a Manage button.
- **Paywall unpublished:** MCP `publish-paywall` must not run without an explicit publish ask.
  Package purchase path works without a published paywall; `presentPaywall` needs a published
  paywall on the offering.
- No ADR: reversible client integration against an existing RC project; no durable platform boundary
  change yet (server-side entitlement gating still future work).

## Verification

```text
pnpm --filter @bizo/web test       # passed — 53 tests (incl. revenuecat entitlements.spec)
pnpm --filter @bizo/web typecheck  # passed
pnpm --filter @bizo/web lint       # passed
pnpm agent:verify                  # run at handoff
```

Manual browser purchase against Test Store: not run this session.

## Follow-ups

- **Publish the paywall** in RevenueCat (draft `pw69c72316840643c8`) so `presentPaywall` works:
  dashboard builder or `publish-paywall` after explicit human ask.
- Connect a **RevenueCat Billing** (`rc_billing`) or Stripe app for real card checkout; current key
  is Test Store (`test_…`).
- Server-side entitlement enforcement (API gate on `Qloudi Pro`) — client check alone is not
  authoritative.
- Optional: rename entitlement lookup key from `Qloudi Pro` (space) to `qloudi_pro` for safer
  identifiers (requires dashboard + code constant change).

## Handoff notes

- Public key env: `NEXT_PUBLIC_REVENUECAT_WEB_API_KEY`.
- Entitlement id string is exactly `Qloudi Pro`.
- Claim `clm_5fe30104` released with this entry.
- Paywall editor: https://app.revenuecat.com/projects/fc47935f/paywalls/pw69c72316840643c8/builder
