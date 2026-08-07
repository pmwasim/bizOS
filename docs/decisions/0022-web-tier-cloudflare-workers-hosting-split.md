# ADR-0022: Web tier hosting split — apps/web to Cloudflare Workers via OpenNext

Status: Proposed

Date: 2026-08-07

Deciders: Release engineering

## Context

ADR-0015 accepted managed Node hosting on Render Free for both `apps/web` and `apps/api`, behind
Cloudflare DNS/TLS. That decision assumed Render Free's idle spin-down was tolerable for a private
beta.

Operational experience since then has shown that the 750 instance-hours per workspace per calendar
month granted by Render Free is **not enough for two always-warm services**. Two services kept warm
around the clock need ~1,460 hours — roughly double the grant. The keep-warm worker introduced in
the 2026-08-06 session (demand-driven, budget-guarded) mitigates this but cannot eliminate cold
starts: if both services consume the grant, neither can stay warm.

A static audit of `apps/web` (recorded in `docs/spikes/opennext-cloudflare-web.md`) confirmed that
the Next.js frontend has no obvious incompatibilities with the Cloudflare Workers runtime via the
`@opennextjs/cloudflare` adapter. Moving `apps/web` to Workers Free removes it from the Render
budget entirely: Workers do not spin down, so the web tier becomes permanently instant, and the
NestJS API is left as the sole occupant of the 750-hour grant — enough to stay warm effectively 24/7
during working hours.

Moving the **API** to Cloudflare Workers is not viable at zero budget: Workers cannot run NestJS +
Express 5, `argon2` (native), `nodemailer` (SMTP over TCP), or Prisma with PostgreSQL as the API
uses them. Cloudflare Containers require the Workers Paid plan ($5/month minimum).

## Decision drivers

- **Zero-budget constraint** — infrastructure cost must remain at zero.
- **Eliminate web-tier cold starts permanently** — the only real fix, not just mitigation.
- **API cannot run on Workers** — native dependencies, SMTP, PostgreSQL rule it out.
- **Workers Free 3 MiB compressed limit** — tight but plausible (spike estimates ~2.2 MiB).
- **Minimize application rewrites** — OpenNext handles the Next.js → Workers adaptation.

## Options considered

### Option A: Keep both services on Render Free (status quo)

Cold starts persist. The keep-warm worker helps during active periods but cannot guarantee warm
state for two services within the 750-hour budget. Users see Render's "SERVICE WAKING UP"
interstitial intermittently.

### Option B: Move apps/web to Cloudflare Workers Free via OpenNext; keep apps/api on Render

Web tier becomes permanently instant (no spin-down). API gets the full 750-hour grant as the sole
service, which is sufficient for continuous warm state during working hours. Total cost stays at
zero. Requires the OpenNext build to produce a Worker under the 3 MiB compressed limit.

### Option C: Cloudflare Workers Paid ($5/month) for both services

Would solve size limits (10 MiB) and enable Containers for the API. Violates the zero-budget
constraint. Recorded for visibility.

### Option D: Alternative free hosting (Vercel, Netlify) for apps/web

Adds a third vendor. Auth.js/BFF compatibility untested. Does not leverage the existing Cloudflare
zone. No clear advantage over Option B.

## Decision

Choose **Option B**. Deploy `apps/web` to Cloudflare Workers Free using `@opennextjs/cloudflare`.
Retain `apps/api` on Render Free as the sole service consuming the 750-hour instance-hours grant.

### Deployment topology after adoption

```text
                 ┌──────────────────┐
  Browser ──────▸│  Cloudflare Edge  │
                 │  DNS / TLS / CDN  │
                 └──┬───────────┬───┘
                    │           │
          ┌─────────▼──┐  ┌────▼────────────┐
          │  Workers   │  │  Render Free     │
          │  (Free)    │  │  (750h budget)   │
          │  apps/web  │  │  apps/api        │
          │  OpenNext  │  │  NestJS          │
          └────────────┘  └─────────────────┘
                    │           ▲
                    └───────────┘
                   internal API calls
```

### Implementation details

- **Separate build scripts**: `apps/web` gets `cf:build` and `cf:preview` scripts alongside the
  existing `build` (Render standalone). `next.config.ts` output made conditional on `CF_BUILD` env.
- **`KEPT_WARM_SERVICES`** in `ops/cloudflare-health-worker` drops from `2` to `1`. The health
  worker stops probing the web URL as a Render spin-up target; it becomes a Workers availability
  check (always 200 unless Workers itself is down).
- **`cold-start-retry.ts`** in `apps/web` remains: it protects web → API calls, and the API can
  still be cold on Render.
- **Worker secrets**: `AUTH_SECRET`, `INTERNAL_AUTH_SECRET`, and `API_INTERNAL_URL` set via
  `wrangler secret put`.
- **`.open-next`** added to `.gitignore`.
- **Go/no-go gate**: `pnpm exec opennextjs-cloudflare build` must produce a Worker under 3 MiB
  compressed. If it exceeds the limit, this ADR is not adopted.

## Consequences

### Positive

- Web tier: no cold start, ever. Instant response for all users.
- API tier: sole occupant of 750-hour grant. Can stay warm continuously during working hours with
  the demand-driven keep-warm worker.
- Total infrastructure cost: zero.
- No application rewrites needed for `apps/web`.

### Negative

- **3 MiB Worker size limit** constrains future web growth (new pages, heavier dependencies). Must
  monitor bundle size on every deploy.
- **Two deployment targets** — Render for API, Cloudflare Workers for web — adds operational
  complexity.
- **OpenNext adapter dependency** — an additional layer between Next.js and the runtime. Breaking
  changes in Next.js or OpenNext could block deploys.
- **Two deploy pipelines** required instead of one.

### Risks

- Worker bundle exceeds 3 MiB compressed — hard stop, fall back to status quo.
- `brace-expansion` override conflict with OpenNext's transitive `minimatch@8` dependency needs
  resolution before the first build (tracked in spike doc).

## Validation and review trigger

- **Go/no-go**: OpenNext build must produce a Worker under 3 MiB compressed.
- **Preview**: `opennextjs-cloudflare preview` must pass sign-in, `/start`, business creation, and
  quotation PDF preview under `workerd`.
- **Revisit** when Workers Paid is approved, web bundle approaches 3 MiB, or API moves off Render.

## References

- [ADR-0015: Managed hosting behind Cloudflare](0015-managed-hosting-behind-cloudflare.md)
- [Spike: OpenNext on Cloudflare](../spikes/opennext-cloudflare-web.md)
- [Journal: Render cold start and OpenNext spike](../journal/2026-08-06-render-cold-start-and-opennext-spike.md)
- [OpenNext Cloudflare docs](https://opennext.js.org/cloudflare)
- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
