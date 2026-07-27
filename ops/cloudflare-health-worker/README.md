# bizOS health worker (Cloudflare Free)

Cron + Workers KV probe for production web/API. Stays on **Workers Free** (≤5 cron triggers, 100k
req/day, KV write budget).

## Why not Cloudflare Health Checks / orange-cloud?

- Standalone Health Checks are **not** on Free (Pro+).
- `bizos.*` / `api.bizos.*` CNAMEs to Render **must remain DNS-only**. Orange-clouding onrender
  targets returns “prohibited IP”.

## What this uses (free)

| Resource                         | Use                                      |
| -------------------------------- | ---------------------------------------- |
| Workers Free                     | Cron every 30 minutes + on-demand `/run` |
| Workers KV `bizos-health-status` | Last probe JSON                          |
| workers.dev route                | Status JSON without touching app DNS     |

## Endpoints (after deploy)

- `GET /status` or `/` — last probe (`200` if ok, `503` if failing/missing)
- `GET /run` — run probes immediately and persist

## Deploy

Requires a Cloudflare API token with **Workers Scripts Edit** and **Workers KV Storage Edit**
(account-scoped), in addition to the zone DNS token used for edge bootstrap — or one combined
least-privilege token. Never print the token.

```bash
cd ops/cloudflare-health-worker
pnpm install
pnpm exec wrangler deploy
```

Or run GitHub workflow **Deploy Cloudflare health worker**.

## Limits to watch (monthly free-tier review)

- Cron invocations ≈ 48/day at `*/30`
- KV writes ≈ 48/day (Free allows 1,000 writes/day)
- Subrequests: 2 fetches per run (well under Free 50/invocation)
