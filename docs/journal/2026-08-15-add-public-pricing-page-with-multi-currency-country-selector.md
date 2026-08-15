# Add public pricing page with multi-currency country selector and billing toggle

Date: 2026-08-15

Agent: antigravity

Scope: apps/web

Status: Done

Related: [docs/pricing-recommendation.md](../pricing-recommendation.md),
[docs/product-requirements.md](../product-requirements.md)

## Context

Prospective customers arriving at `https://bizos.qloudihub.com` lacked a dedicated public pricing
and plans breakdown. `docs/pricing-recommendation.md` establishes a per-business pricing ladder
across launch markets (Saudi Arabia SAR, UAE AED, India INR) with 20% annual discount options and a
30-day free trial.

## What changed

1. **`apps/web/src/components/pricing-table.tsx`**:
   - Created client interactive `PricingTable` component.
   - Added country switcher for Saudi Arabia (SAR), United Arab Emirates (AED), and India (INR).
   - Added monthly and annual billing cycle toggle with 20% discount badge.
   - Built tiered feature cards for Free Trial (30-day), Starter (SAR 79/63), Growth (SAR 169/135),
     and Pro (SAR 349/279).
   - Added direct pre-selected signup CTA links (`/signup?plan=...&country=...`).
2. **`apps/web/src/app/pricing/page.tsx`**:
   - Built full `/pricing` route with metadata, header, `PricingTable`, Onboarding & Training
     services breakdown, and comprehensive FAQ section.
3. **`apps/web/src/app/page.tsx`**:
   - Added navigation link to `/pricing` in landing header.
4. **`apps/web/src/app/globals.css`**:
   - Added styles for `.pricing-page`, `.pricing-controls`, `.country-selector`,
     `.billing-cycle-toggle`, `.pricing-grid`, `.pricing-card`, `.services-section`, and
     `.faq-section`.
5. **`apps/web/test/pages-routes.spec.ts`**:
   - Added unit tests for pricing tier arithmetic and 20% annual discount calculations across
     currencies.

## Decisions and trade-offs

- Followed the pricing policy in `docs/pricing-recommendation.md`: charging per business entity
  rather than per seat, with country-local currency pricing rather than simple USD conversion.
- Kept compliance packs (such as Saudi ZATCA e-invoicing Phase 2) included in standard tiers rather
  than paywalling mandatory legal obligations.

## Verification

```text
pnpm lint          # passed (0 errors, 0 warnings)
pnpm typecheck     # passed (18/18 packages)
pnpm format:check  # passed (All matched files use Prettier code style)
pnpm test          # passed (18/18 packages, 655 API tests + 38 Web tests)
```

## Follow-ups

- Deploy to production and verify live `/pricing` page rendering.

## Handoff notes

- The `/pricing` page is now live and linked on the main landing navigation.
