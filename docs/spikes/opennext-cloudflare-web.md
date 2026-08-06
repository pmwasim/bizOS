# Spike: move `apps/web` to Cloudflare Workers via OpenNext

Status: Proposed — static audit complete, build not yet run

Last reviewed: 2026-08-06

## Why

`bizos` (web) and `api.bizos` are both Render Free services. Render Free spins a service down after
~15 minutes idle and grants **750 instance-hours per workspace per calendar month**. Two services
kept warm around the clock need ~1,460 hours, so both cannot stay awake within the grant.

Moving the frontend to Cloudflare Workers removes it from that budget entirely: Workers do not spin
down, so the web tier becomes permanently instant, and the NestJS API is left alone in the 750-hour
grant — enough to stay warm effectively 24/7. Total infrastructure cost stays at zero.

This is the only zero-budget path that removes cold starts rather than merely hiding them. Running
the **API** on Cloudflare is not viable at zero budget: Cloudflare Containers require the Workers
Paid plan, and the Workers runtime cannot run NestJS + Express 5, `argon2`, `nodemailer`, or
PostgreSQL as the API uses them today.

## Findings

### Resolved: Next.js 16 is supported

OpenNext's Cloudflare adapter supports "all minor and patch versions of Next.js 16". `apps/web` is
on Next.js 16.2.12, so the version concern raised earlier does not apply.

### Clear: nothing in `apps/web` is obviously incompatible

| Check                           | Result                                                          |
| ------------------------------- | --------------------------------------------------------------- |
| `middleware.ts`                 | **None.** Node middleware is unsupported by OpenNext; not used. |
| `export const runtime`          | **None.** No edge-runtime declarations to remove.               |
| Node built-in imports           | Only `node:crypto` (`createHmac`) — covered by `nodejs_compat`. |
| Native dependencies             | None. `argon2` and `pdfkit` live in `apps/api`, not `apps/web`. |
| App Router, SSR, Route Handlers | All supported.                                                  |

### The real risk: Worker size limit on the free plan

A Worker may be **3 MiB compressed on Workers Free** (10 MiB on Paid). OpenNext bundles the Next.js
server runtime and application code into a single Worker.

Measured from the existing local build, `.next/server` JavaScript compresses to **~1.48 MB**. That
is application server code only — the deployed Worker also carries the Next.js server runtime,
React, and the OpenNext shim, so the true figure will be materially higher. For reference, the
OpenNext docs' own worked example lands at ~2.24 MiB compressed.

**Plausible, but genuinely tight.** This is the go/no-go criterion, and it can only be settled by
running the build.

### Open question: `output: "standalone"`

`next.config.ts` sets `output: "standalone"` and the `build` script chains
`scripts/prepare-next-standalone.mjs`, both of which exist to serve Render. OpenNext invokes the
package's `build` script and consumes the standard Next build output. These two need to be separated
so the Render path keeps working during and after the trial — the safest shape is a distinct
Cloudflare build script rather than changing the default `build`.

## Not yet done

The build has not been run. It requires `pnpm install` with platform-native binaries, which was not
available in the environment where this audit was performed. Everything below is prepared so the
trial is a single sitting.

## Runbook

Run on a branch. Nothing here should reach `main` until step 4 passes.

### 1. Install

```bash
cd apps/web
pnpm add -D @opennextjs/cloudflare@latest wrangler@latest
```

### 2. Add `apps/web/open-next.config.ts`

```ts
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig();
```

R2 incremental caching can be added later; leave it out of the first build so a cache
misconfiguration cannot be mistaken for an incompatibility.

### 3. Add `apps/web/wrangler.jsonc`

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "main": ".open-next/worker.js",
  "name": "bizos-web",
  "compatibility_date": "2026-07-27",
  "compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"],
  "assets": {
    "directory": ".open-next/assets",
    "binding": "ASSETS",
  },
  "services": [{ "binding": "WORKER_SELF_REFERENCE", "service": "bizos-web" }],
}
```

### 4. Build — this is the go/no-go gate

```bash
cd apps/web
pnpm exec opennextjs-cloudflare build
```

Read the `Total Upload: … / gzip: …` line. **The gzip figure must be under 3 MiB.**

- Under 3 MiB → continue.
- Over 3 MiB → stop. Options are trimming the server bundle, or accepting that the web tier stays on
  Render. Do not pay to raise the limit without deciding that separately.

### 5. Preview in the Workers runtime

```bash
pnpm exec opennextjs-cloudflare preview
```

Exercise sign-in, `/start`, a business, and a quotation PDF preview. `next dev` uses Node; this step
is what proves the app behaves under `workerd`.

### 6. Secrets

`readWebEnvironment` requires these. Set each with `pnpm exec wrangler secret put <NAME>`:

| Variable               | Note                                                                |
| ---------------------- | ------------------------------------------------------------------- |
| `AUTH_SECRET`          | Reuse the existing value — rotating it invalidates all sessions.    |
| `INTERNAL_AUTH_SECRET` | Must match the API's value or every internal assertion is rejected. |
| `API_INTERNAL_URL`     | `https://api.bizos.qloudihub.com/api/v1`                            |

### 7. Housekeeping

- Add `.open-next` to `.gitignore`.
- Add `apps/web/public/_headers` with:
  ```
  /_next/static/*
    Cache-Control: public,max-age=31536000,immutable
  ```

### 8. Cut over

Only after preview passes. Point `bizos.qloudihub.com` at the Worker, keep the Render web service
suspended rather than deleted for a week in case of rollback.

## Consequences if adopted

- Web tier: no cold start, ever.
- API tier: sole occupant of the 750-hour grant, so it can stay warm continuously. The keep-warm
  worker's `KEPT_WARM_SERVICES` should drop from `2` to `1`, roughly halving tallied usage.
- `ops/cloudflare-health-worker` should stop probing `WEB_URL` as a Render service — it becomes a
  Workers availability check, not a spin-up probe.
- The cold-start retry in `apps/web/src/lib/cold-start-retry.ts` stays relevant: it protects web →
  API calls, and the API can still be cold.

## References

- [OpenNext Cloudflare overview](https://opennext.js.org/cloudflare)
- [OpenNext Cloudflare get started](https://opennext.js.org/cloudflare/get-started)
- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare Containers pricing](https://developers.cloudflare.com/containers/pricing/)
- [Render free tier](https://render.com/docs/free)
