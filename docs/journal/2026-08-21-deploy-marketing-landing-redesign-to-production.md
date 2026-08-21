# Deploy marketing landing redesign to production

Date: 2026-08-21

Agent: cursor-landing

Scope: apps/web, docs/journal

Status: Done

Related: [design journal](2026-08-21-design-unique-bizos-home-and-landing-pages.md),
[PR #119](https://github.com/pmwasim/bizOS/pull/119)

## Context

Live `https://bizos.qloudihub.com` still served the pre-redesign homepage title and returned 404 for
`/product`. Production checkout was at `9815ff7`. `main` includes the marketing redesign
(`b5c09ca`).

## Production deploy (Tier 2)

**Rollback SHA (live before this deploy):** `9815ff7` in `/home/wasim/bizos-production`.

**Target SHA:** `aebe92a` (`origin/main`).

**Rollback command:**

```bash
cd /home/wasim/bizos-production && git fetch && git checkout 9815ff7 && set -a && . ./.env && set +a && unset NODE_ENV && NODE_ENV=production pnpm install --frozen-lockfile && NODE_ENV=production pnpm --filter @bizo/api... build && NODE_ENV=production pnpm --filter @bizo/web... build && sudo systemctl restart bizos-api bizos-web
```

## What changed

- Fast-forwarded `/home/wasim/bizos-production` `9815ff7` → `aebe92a`.
- `NODE_ENV=production` install + `@bizo/api...` and `@bizo/web...` builds.
- Restarted `bizos-api` and `bizos-web` (both active).

## Decisions and trade-offs

- Forced claim so the deploy journal could proceed despite an overlapping docs claim.
- No Prisma migrations between `9815ff7` and `aebe92a`.
- Deployed current `main` (includes marketing redesign plus UI overhaul and API audit commits).

## Verification

```text
Live / title — bizOS — The Business Operating System for service companies
Live / — contains "Run the business in plain language" + mkt-hero-brand
Live /product — 200, "The product customers actually buy"
systemctl is-active bizos-web bizos-api — active / active
http://127.0.0.1:3001/api/v1/health — 200
pnpm ops:release-readiness — 14/14 passed
```

## Follow-ups

- Optional: wait for `main` CI on `aebe92a` to finish green (deploy proceeded after local production
  build succeeded).

## Handoff notes

Production is on `aebe92a`. Rollback SHA remains `9815ff7` with the command above.
