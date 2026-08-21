# Public sales readiness for bizos.qloudihub.com

Date: 2026-08-21

Agent: cursor-sales

Scope: apps/web, docs, scripts/ops

Status: Ready for review

Related:
[sales & marketing audit canvas](../../.cursor/projects/home-wasim-bizOS/canvases/bizos-sales-marketing-readiness.canvas.tsx),
[RevenueCat Web SDK journal](2026-08-21-integrate-revenuecat-web-sdk-for-qloudi-pro.md)

## Context

Live audit of `https://bizos.qloudihub.com` found the site was not ready for paid public
acquisition: overclaims (statements without beta on prod, ZATCA Phase 2 FAQ), invite vs open-signup
contradiction, no Privacy/Terms/Contact, no `/subscribe`, no robots/sitemap/OG, and production stuck
at `0025523` while `main` already had beta markers and Sprints 2–6.

Owner asked for autonomous, authoritative work until public-sales ready; Munder Difflin hive is
available if needed (`/home/wasim/HarnessAgents/hive`).

## What changed

- Marketing shell with footer links to Pricing, Subscribe, Contact, Privacy, Terms.
- Public pages: `/privacy`, `/terms`, `/contact`; `robots.ts` + `sitemap.ts`; Open Graph /
  metadataBase.
- Homepage and sign-in: open free-trial funnel (removed private-beta invite contradiction).
- Pricing honesty: beta markers for statements, ZATCA QR/UBL, API/webhooks; honest FAQ; removed
  “hundreds of businesses” / “certified specialists”; list-tier CTAs start trial; Qloudi Pro via
  `/subscribe`.
- RevenueCat Web SDK + `/subscribe` + settings link (from prior WIP) included on this branch.
- `pnpm ops:release-readiness` probes pricing, subscribe, legal, robots.

## Decisions and trade-offs

- **Open self-serve trial** is the public funnel; invite-only copy removed from sign-in.
- **List-tier CTAs** start a free trial rather than implying instant paid checkout for
  Starter/Growth/Pro.
- **Self-serve paid path** is Qloudi Pro via RevenueCat (`/subscribe`); Test Store until RC
  Billing + Stripe are connected (Admin packet).
- **Honest beta markers** for statements, ZATCA Phase 1 vs Fatoora clearance, and API/webhooks.

## Verification

```text
pnpm --filter @bizo/web test        # passed — 53 tests
pnpm --filter @bizo/web typecheck   # passed
pnpm --filter @bizo/web lint        # passed (pages-dir eslint warning pre-existing)
pnpm ops:release-readiness          # after production deploy
```

## Follow-ups

- Deploy production from this branch after merge (rollback SHA: production was `0025523`).
- Connect RevenueCat Billing / Stripe for real card checkout; publish paywall `pw69c72316840643c8`.
- Set `NEXT_PUBLIC_REVENUECAT_WEB_API_KEY` on `/home/wasim/bizos-production/.env`.
- Confirm `hello@qloudihub.com` mailbox receives mail.
- Optional first-party analytics (Plausible) — not added (no account / zero-budget).

## Handoff notes

Claim `clm_27b46ed1` held by `cursor-sales` on `apps/web`, `docs`, `.agent`.
