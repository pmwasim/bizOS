# Render cold starts, keep-warm, and the OpenNext spike

Date: 2026-08-06

Agent: claude-opus (Cowork session)

Scope: `ops/cloudflare-health-worker/`, `apps/api/src/common/`, `apps/web/src/lib/`,
`packages/config/src/`, `docs/spikes/`, `.env.example`

Status: In progress — keep-warm and retry work complete and verified; OpenNext build spike blocked
on a dependency conflict

Related: [Spike: OpenNext on Cloudflare Workers](../spikes/opennext-cloudflare-web.md)

## Context

Session opened with a screenshot of Render's "SERVICE WAKING UP" interstitial on
`bizos.qloudihub.com`, described as appearing intermittently. A second screenshot later in the
session showed `/start` returning Next.js's "This page couldn't load" server-error page
(`ERROR 1826286119`).

The controlling constraint throughout was **budget must stay at zero**, stated explicitly, and
reaffirmed when the option of a paid plan came up.

Investigation established the underlying arithmetic:

- Render Free spins a service down after ~15 minutes idle.
- Render grants **750 instance-hours per workspace per calendar month**.
- bizOS runs **two** Free services (`bizos` web, `api.bizos`). Keeping both awake around the clock
  needs ~1,460 hours — roughly double the grant.

The pre-existing `ops/cloudflare-health-worker` ran on a `*/30` cron. Because that is less frequent
than the 15-minute spin-down, it never kept anything warm; it only measured the cold start it had
itself triggered. Every cycle contained a guaranteed ~15-minute window in which both services were
asleep.

## What changed

### Keep-warm: demand-driven instead of scheduled

`ops/cloudflare-health-worker/src/index.js` rewritten. Warmth now follows real usage rather than a
clock, because with no fixed working hours a schedule cannot be fitted to the 750-hour grant.

- `POST /wake` extends a `warm-until` deadline in KV (45 minutes past the last real request).
- Cron moved `*/30` → `*/5` in `wrangler.jsonc`, but the tick **only probes while warm**. Probing is
  what keeps Render awake, so silence during idle periods is what keeps the cost at zero.
- A **cold boot check** still runs once every 24 hours, so a service that genuinely cannot start is
  distinguished from one that is merely asleep.
- A **budget guard** tallies estimated instance-minutes per calendar month and stops keeping warm at
  `MONTHLY_BUDGET_HOURS` (690), leaving margin under 750 for deploys and restarts.
- `/status` now reports warm state and budget usage, and returns `200` when a service is
  deliberately asleep — asleep by design is not a failure.

`apps/api/src/common/keep-warm.middleware.ts` (new) pings `/wake` fire-and-forget, throttled
in-process to once per 5 minutes, registered in `app.module.ts` for all routes.

`packages/config/src/api.ts` gained `KEEP_WARM_URL` and `KEEP_WARM_SECRET`, validated as a pair and
required to be HTTPS in production. `.env.example` documents both.

Expected cost: a six-hour working day across both services ≈ 360 instance-hours/month. Idle weeks
cost nothing.

### Web resilience to a cold API

`apps/web/src/lib/cold-start-retry.ts` (new), wired into both `publicApiFetch` and `apiFetch`.

Web and API sleep independently, so "web awake, API booting" is a routine state. Previously any
non-OK response threw `ApiError` straight out of a server component, producing a 500 — the observed
`/start` failure path.

Retries back off 2s → 5s → 10s → 15s → 15s (~47s, covering a typical boot).

### `/start` 500 — cause not confirmed

The retry work hardens the most likely path but **the actual cause of `ERROR 1826286119` was never
confirmed**. That digest maps to a stack trace in the Render web-service logs and nobody has read
it. Do not treat this as closed.

### OpenNext spike

`docs/spikes/opennext-cloudflare-web.md` (new) records the static audit. Nothing in `apps/web` was
committed toward the migration.

## Decisions and trade-offs

**Demand-driven warmth over a business-hours schedule.** Rejected because there are no fixed working
hours. A wall-clock window would either waste the grant or miss real usage.

**Health probes excluded from waking.** The worker probes `/api/v1/health`; counting that as user
activity would hold the warm window open permanently and drain the grant. This was the highest-cost
mistake available and is guarded by a test.

**Mutations are not blindly replayed.** A `503` is Render's pre-boot response, so the origin
provably never saw the request — safe to replay for any method. A `502`/`504` may mean the request
was received and timed out midway, so those replay only for GET/HEAD/OPTIONS. Quotations and
invoices cannot be double-submitted by the retry.

**Internal JWT minted per attempt.** The assertion lives 2 minutes; retrying for ~47s off a token
signed once up front risked sending an expired assertion on the final try.

**Rejected: moving the API to Cloudflare.** Cloudflare Containers require the Workers Paid plan
($5/mo minimum), so at zero budget only Workers isolates are available. That runtime cannot run
NestJS + Express 5, `argon2` (native), `nodemailer` (SMTP over TCP), or PostgreSQL as the API uses
them. The schema carries 207 Postgres-specific annotations. Replacing `argon2` would also invalidate
every stored password hash. Judged a rewrite, not a migration.

**Rejected: paying $5/mo for Workers Paid.** Would solve the size limit and enable Containers, but
violates the stated constraint. Recorded so the option is visible, not taken.

**Accepted direction: move only `apps/web` to Cloudflare.** Frees the API to occupy the 750-hour
grant alone. Has architectural consequences (deployment topology, `KEPT_WARM_SERVICES` drops to 1)
and **should get an ADR in `../decisions/` before adoption** — raised here, not yet written.

## Verification

Run from the workspace mount with `node_modules/.bin` on `PATH`.

```text
apps/api      tsc --noEmit        # passed
packages/config tsc --noEmit      # passed
apps/web      tsc --noEmit        # passed
apps/api      vitest run          # passed — 158 passed, 43 skipped (integration)
packages/config vitest run        # passed — 11 passed (3 new)
apps/web      vitest run          # passed — 15 passed (9 new)
eslint <changed files>            # passed, no output
prettier --check <changed files>  # passed after one --write pass
node scripts/check-doc-links.mjs  # passed — all local Markdown links resolve
pnpm check                        # NOT RUN — pnpm unavailable in the session sandbox
pnpm build                        # NOT RUN — same reason
```

Sandbox caveat: `node_modules` is macOS-installed and the session sandbox is Linux, so `vitest`
initially failed on a missing `@rolldown/binding-linux-arm64-gnu`. That binding was copied into
`node_modules/.pnpm/rolldown@1.1.5/node_modules/@rolldown/` to let the suites run. It is gitignored
and `pnpm install` will reconcile it, but it is still sitting there.

## Follow-ups

1. **Read the Render log for `ERROR 1826286119`.** The `/start` 500 cause is unconfirmed. Blocks
   claiming that failure is fixed.
2. **Resolve the `brace-expansion` override conflict** — see handoff notes. Blocks the OpenNext
   build, and is worth understanding regardless of whether the migration proceeds.
3. **Deploy the keep-warm worker**: `wrangler secret put WAKE_SECRET`, then set `KEEP_WARM_URL` and
   `KEEP_WARM_SECRET` on the Render API service. Until both sides are set the middleware is inert
   and behaviour is unchanged, so the code is safe to merge unmerged-deployed.
4. **Establish where PostgreSQL lives**, its expiry/size limits, and the backup story. Flagged twice
   during the session and never answered. Data loss is a larger threat to smooth running than any
   cold start.
5. **Write an ADR** for the web-tier hosting split before adopting the OpenNext direction.
6. **Cut the ~20s API boot** (lazy Prisma connect, defer non-critical modules). Independent of
   hosting and still worthwhile.
7. **Revoke the spike SSH key** — see handoff notes.

## Handoff notes

### The OpenNext build is blocked on a real, repo-level finding

A throwaway build was attempted on the user's Ubuntu 26.04 box (`ubuntu-ms-7978.tail8308ed.ts.net`,
8 cores / 30 GB) reached over Tailscale. Source was rsynced excluding `node_modules`, `.next`,
`.turbo`, `.git`, and **all `.env` files**; no secrets left the workstation, and build-time env used
obvious placeholder values.

The build fails before producing `.open-next/worker.js`:

```text
node_modules/.pnpm/minimatch@8.0.7/node_modules/minimatch/dist/mjs/index.js:1
import expand from 'brace-expansion';
SyntaxError: The requested module 'brace-expansion' does not provide an export named 'default'
```

`pnpm-workspace.yaml` pins `overrides: "brace-expansion": "^5.0.9"`. brace-expansion v5 changed its
export shape, and `minimatch@8` in the OpenNext dependency chain expects a CommonJS-interop default
export. **This is a conflict between an existing security override and the new toolchain, not an
OpenNext/Next.js 16 incompatibility.** Options: scope the override so it does not reach minimatch's
tree, or find a minimatch version compatible with brace-expansion v5.

### What the static audit already settled

Next.js **16 is supported** by `@opennextjs/cloudflare` (an earlier caveat in this session was
wrong, corrected after reading the docs). `apps/web` has no `middleware.ts`, no
`export const runtime = "edge"`, and one Node built-in (`node:crypto` `createHmac`, covered by
`nodejs_compat`). The native dependencies live in `apps/api`, which is not moving.

**The unanswered question is Worker size.** Workers Free caps a Worker at **3 MiB compressed** (10
MiB paid). Local `.next/server` JS compresses to ~1.48 MB, but that excludes the Next server
runtime, React, and the OpenNext shim; OpenNext's own worked example lands at ~2.24 MiB. Plausible
but tight. Getting that number is the whole point of the build, and it is still unknown.

### Sharp edges found on the remote box

- Ubuntu's `corepack` 0.24.0 cannot activate pnpm 11 (`ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING`).
  pnpm was installed user-scoped via `npm i -g` with `prefix=~/.npm-global`. No `sudo` used, nothing
  system-wide.
- `pnpm install` fails its `prepare` step without a git repo (`lefthook install`). `git init` in the
  synced copy is enough.
- pnpm 11 hard-fails on unapproved build scripts. `workerd` must be added to **`allowBuilds` in
  `pnpm-workspace.yaml`** — pnpm wrote the placeholder `workerd: set this to true or false` itself.
  Note `pnpm.onlyBuiltDependencies` in `package.json` is **not** the mechanism in this repo.
- Remote-only edits made to the throwaway copy, **not** to this repository: `next.config.ts` output
  made conditional (`process.env.CF_BUILD ? undefined : "standalone"`) so the Render standalone path
  survives, `build` script reduced to `next build`, and `cf:build`/`cf:preview` scripts added.

### Security

An ephemeral ed25519 key (`claude-cowork-bizos-spike-20260806`) was added to
`~/.ssh/authorized_keys` on the Ubuntu box. The private half exists only in a session sandbox that
will be destroyed. **Remove that line** — it grants shell access and will never be usable again by
this session.
