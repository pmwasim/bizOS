# bizOS health worker (Cloudflare Free)

Demand-driven keep-warm **and** health probe for production web/API. Stays on **Workers Free** (≤5
cron triggers, 100k req/day, KV write budget) and inside **Render Free** instance hours.

## The problem this solves

Render Free spins a service down after ~15 minutes idle, and the next request pays a cold start
(~20s, showing Render's "SERVICE WAKING UP" page). Render also grants **750 instance-hours per
workspace per calendar month**.

bizOS runs two Free services (`bizos` web, `api.bizos`). Keeping both awake around the clock would
need ~1,460 hours — roughly double the grant — so a naive "ping every N minutes" keep-warm gets the
workspace suspended mid-month. The previous `*/30` cron had the opposite problem: pinging less often
than the 15-minute spin-down meant it never kept anything warm, it only measured the cold start it
had just caused.

## How warmth works now

1. The API calls `POST /wake` (throttled to once per 5 minutes) whenever a genuine request arrives.
   Health probes are excluded — otherwise this worker would keep itself warm forever.
2. `/wake` extends a `warm-until` deadline in KV, currently **45 minutes** past the last real
   request.
3. The cron runs every 5 minutes but **only probes while `warm-until` is in the future**. Probing is
   what keeps Render awake, so staying quiet during idle periods is what keeps the bill at zero.
4. While cold, a **boot check** still runs once every 24 hours, so a service that can genuinely no
   longer start is not mistaken for one that is merely asleep.
5. A **budget guard** tallies estimated instance-minutes per calendar month and stops keeping warm
   at `MONTHLY_BUDGET_HOURS` (690), leaving margin under the 750 grant for deploys and restarts.

Net effect: the first request after a quiet spell is still cold, then everything stays instant for
as long as work continues. A six-hour working day across both services costs roughly 360
instance-hours a month — comfortably inside the grant. Quiet weeks cost nothing.

## Why not Cloudflare Health Checks / orange-cloud?

- Standalone Health Checks are **not** on Free (Pro+).
- `bizos.*` / `api.bizos.*` CNAMEs to Render **must remain DNS-only**. Orange-clouding onrender
  targets returns "prohibited IP".

## What this uses (free)

| Resource                         | Use                                                    |
| -------------------------------- | ------------------------------------------------------ |
| Workers Free                     | Cron every 5 minutes, `/wake`, on-demand `/run`        |
| Workers KV `bizos-health-status` | Last probe JSON, warm-until state, monthly budget      |
| workers.dev route                | Status JSON and wake endpoint without touching app DNS |

## Endpoints (after deploy)

- `GET /status` or `/` — last probe plus warm state and budget usage. Returns `200` when healthy
  **or** deliberately asleep, `503` only when warm and failing.
- `POST /wake` — extend the warm window. Requires the `x-wake-secret` header (or `?secret=`).
  Returns `202`.
- `GET /run` — probe immediately and persist, regardless of warm state.

## Configuration

Worker secret:

```bash
cd ops/cloudflare-health-worker
pnpm exec wrangler secret put WAKE_SECRET
```

Render API service environment (both required, or keep-warm stays inert):

| Variable           | Value                                                     |
| ------------------ | --------------------------------------------------------- |
| `KEEP_WARM_URL`    | `https://bizos-health.<subdomain>.workers.dev/wake`       |
| `KEEP_WARM_SECRET` | Same value as the worker's `WAKE_SECRET` (≥16 characters) |

Tunables live at the top of `src/index.js`: `WARM_WINDOW_MINUTES`, `MONTHLY_BUDGET_HOURS`,
`COLD_BOOT_CHECK_HOURS`. If you change the cron cadence in `wrangler.jsonc`, update
`CRON_INTERVAL_MINUTES` to match or the budget tally drifts.

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

## Verifying it works

```bash
# Should report warm: false while idle
curl -s https://bizos-health.<subdomain>.workers.dev/status | jq

# Arm the warm window by hand
curl -s -X POST -H "x-wake-secret: $WAKE_SECRET" \
  https://bizos-health.<subdomain>.workers.dev/wake | jq

# Within a minute or two, status should show warm: true and a rising budget.usedHours
```

Then load the app itself: the first hit is cold, and subsequent hits over the next 45 minutes should
be instant.

## Limits to watch (monthly free-tier review)

- Cron invocations ≈ 288/day at `*/5` (Free allows 100k requests/day)
- KV writes ≈ 2/tick **while warm only**, plus ~65/day from `/wake` (Free allows 1,000/day). Idle
  ticks write nothing.
- Subrequests: 2 fetches per probe (well under Free 50/invocation)
- Render instance hours: check `budget.usedHours` on `/status` against the 750 grant
