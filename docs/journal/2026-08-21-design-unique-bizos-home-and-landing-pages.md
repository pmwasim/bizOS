# Design unique bizOS home and landing pages

Date: 2026-08-21

Agent: cursor-landing

Scope: apps/web

Status: Ready for review

Related: [public sales readiness](2026-08-21-public-sales-readiness-for-bizos-qloudihub-com.md),
[product overview](../product-overview.md), [UX principles](../ux-principles.md),
[information architecture](../information-architecture.md)

## Context

Owner asked for a unique, attractive home page and landing page, with copy generated from bizOS
product docs, under full autonomy. Prior marketing home was a short two-column hero with a quotation
card mock and Inter/blue SaaS styling.

Forced claim over `cursor-autonomy`'s overlapping `apps/web` deploy claim (`clm_4e2ced60`) so this
marketing redesign could proceed; deploy work was already recorded as complete in the
sales-readiness journal.

## What changed

- New scoped marketing design system (teal/mist/signal lime, Bricolage Grotesque + Figtree) under
  `.marketing-site` — does not restyle the authenticated app shell.
- Redesigned `/` home/landing: brand-first full-bleed hero, proof journey, plain-language glossary,
  capabilities, launch markets, closing CTA. Copy grounded in product overview / PRD / IA.
- New `/product` landing: ERP foundation, guided experience, workspace surfaces (Today/Work/…).
- Updated `MarketingShell` nav/footer, `sitemap.ts` (+ `/product`), root metadata titles.
- Files: `apps/web/src/app/page.tsx`, `product/page.tsx`, `components/landing-page.tsx`,
  `components/marketing-shell.tsx`, `lib/marketing-fonts.ts`, `app/globals.css`, `app/layout.tsx`,
  `app/sitemap.ts`.

## Decisions and trade-offs

- Visual direction: cool mist + deep teal + signal lime (not purple SaaS, not cream/terracotta, not
  broadsheet). Motion is CSS-only with `prefers-reduced-motion` respect.
- Honest claims only: no “hundreds of businesses”, no ZATCA Phase 2 as done, payments recorded not
  collected online.
- Marketing fonts/CSS scoped so ERP workspace keeps existing Inter/blue tokens.

## Verification

```text
pnpm --filter @bizo/web typecheck   # passed
pnpm --filter @bizo/web lint        # passed (pre-existing pages-dir eslint warning)
pnpm --filter @bizo/web test        # passed — 53 tests
Visual preview http://localhost:3010/ and /product  # verified in browser
```

## Follow-ups

- Human: merge `cursor/marketing-landing-redesign` and deploy production when ready.
- Optional: Arabic marketing mirror later (product ships AR in-app; marketing remains EN for now).

## Handoff notes

- Branch: `cursor/marketing-landing-redesign` (from `origin/main`).
- Scratch preview used `WEB_PORT=3010`; stop that process if still running.
- Claim `cursor-landing` should be released at end of this session.
