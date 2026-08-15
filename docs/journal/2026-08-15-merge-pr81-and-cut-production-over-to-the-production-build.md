# Merge PR81 and cut production over to the production build

Date: 2026-08-15

Agent: claude-cowork

Scope: docs/operations

Status: Complete

Related: PR #81, issue #56, ADR-0022, ADR-0023,
`2026-08-15-stabilize-pr81-for-production-release.md`

## Context

Continues the previous entry, which made PR #81 mergeable. This entry covers the merge itself and
the production cutover the merge unblocked. Production had been serving users from `next dev`,
running out of the development checkout at `/home/wasim/bizOS` — uncommitted edits there changed the
live site.

## What changed

### PR #81 merged

All five required checks green (Quality gate, Analyze TypeScript, Build api image, Build web image,
Review dependency changes). Seven review threads answered and resolved — `main` requires
conversation resolution. Squash-merged as `97b877e` to satisfy the linear-history rule; the branch
carried merge commits from local history.

Two non-required checks are still red and did not block: CodeQL passed after the ReDoS and
open-redirect fixes, but **Prisma Compute Deploy** now fails with
`Entrypoint is required. Pass --entrypoint or define package.json main`. The root `prisma.config.ts`
fixed its first error; this second one is the Prisma Cloud product trying to deploy a compute
service the repository does not have. Production is the Ubuntu host (ADR-0022), so that integration
has nothing to deploy — see Follow-ups.

### The reason production was stuck on `next dev`

`@bizo/web#build` had been recorded in AGENTS.md as an unexplained pre-existing Next 16 / React 19
failure: `TypeError: Cannot read properties of null (reading 'useContext')` while prerendering
`/_global-error`.

It is not a version problem. The build was being run after `set -a && . ./.env`, and `.env` carries
`NODE_ENV=development`. `next build` under that flag mixes React's development and production
bundles. The same tree builds 9/9 with `NODE_ENV=production`, which is why CI — where `NODE_ENV` is
unset — never saw it. AGENTS.md and `.env.example` are corrected.

`/home/wasim/bizos-production/.env` also carried `NODE_ENV=development`, so a cutover without
noticing would have left production running in development mode with `useSecureCookies` off — that
is, session cookies with no `Secure` attribute on an HTTPS site.

### Cutover

Full sequence, verification table, consequences, and rollback are in
[ubuntu-production-cutover.md](../operations/ubuntu-production-cutover.md#applied-2026-08-15). In
brief: production checkout repointed at GitHub and moved to `97b877e`; database dumped; three
additive migrations applied; `APP_BASE_URL` and `NODE_ENV=production` set; built; smoke-tested on a
scratch port before touching systemd; both units switched with `.bak` copies kept.

`bizos-api.service` was repointed in the same pass rather than left for later — leaving it on the
development checkout would have kept exactly the coupling this cutover exists to remove.

## Decisions and trade-offs

**Merged to `main` and deployed to production, which AGENTS.md reserves for a human.** The
repository owner instructed this session to work autonomously and authoritatively, without asking
for permission, and to get a stable production release out as quickly as possible. That is the
authority under which both steps were taken. Everything reversible was made reversible first: a
`pg_dump` before migrating, `.bak` copies of both unit files and of `.env`, and a smoke test on
`:3998` before any service was touched. The boundary in AGENTS.md is unchanged and still applies to
agents working without that instruction.

**Set `NODE_ENV=production` in the production `.env` rather than only in the systemd units.** The
unit-level `Environment=` would have covered the running services, but the same file is sourced by
anyone building or running a command in that tree, which is exactly how the build failure survived.
The cost is that every signed-in user is signed out once, because Auth.js now reads
`__Secure-authjs.session-token` and ignores the old cookie.

**Left the three additive migrations un-reversed in the rollback path.** They add a table, a
row-level-security policy, and two defaulted columns. Nothing on the previous build reads them, so
rolling the services back does not require rolling them back.

## Verification

```text
gh pr checks 81                                    # 5/5 required checks pass
prisma migrate status (production)                 # schema up to date, 20 migrations
pnpm build (production checkout, NODE_ENV=production)  # 9/9 tasks, standalone emitted
smoke on :3998                                     # / /signin /forgot-password /reset-password → 200
                                                   #   0 dev fingerprints; CSP hardened
systemctl is-active bizos-api bizos-web            # active, active
node scripts/ops/release-readiness.mjs             # 8/8 passed
https://bizos.qloudihub.com/signin                 # 200
```

The first `release-readiness` run reported 7/8 — `api.health.contract` aborted while the API was
still restarting. The immediate re-run was 8/8 and the endpoint answers in 0.25 s.

Not verified: a signed-in end-to-end journey against production. That needs real credentials and
would write real data, so it was not attempted. The e2e suite covers those journeys in CI.

## Follow-ups

- **Issue #56** (`/signin` returns a stale Next.js 404) is resolved by the cutover — the 404 came
  from the dev server. Closed with the evidence above.
- **Prisma Compute Deploy fails on every push** and will keep doing so. It is not a required check.
  Production is the Ubuntu host, so the integration has nothing to deploy: disconnect it in the
  repository's GitHub App settings, or give the Prisma project an entrypoint if it is wanted for
  something. Decide rather than leaving a permanently red check that trains everyone to ignore check
  failures.
- **PR #37** (build metadata on the health endpoint) has been open since 2026-07-28. Merging it
  makes `release-readiness` able to assert the deployed SHA, which is the difference between "the
  site is up" and "the site is running what I just shipped".
- **16 open Dependabot PRs**, several major: `ioredis 5→6`, `bullmq 5→6`, `next 16.2.12→16.3.0`, and
  Docker base `node 22.23.1→26.7.0` in both apps. The Node bump contradicts the `engines` range
  (`>=22.13 <25`) — close #68 and #69, or widen the range deliberately.
- **A per-business receivables view** does not exist; ADR-0023 derives settlement one invoice at a
  time, which is all the current screens need.
- **No `db:backup` script.** The pre-cutover dump was taken by hand into
  `/home/wasim/bizos-backups`. Until backup and restore are exercised, the README's warning against
  storing irreplaceable data stands.

## Handoff notes

Claim `clm_b243347e` is released.

- Production runs from `/home/wasim/bizos-production` on `main`. **Do not deploy from
  `/home/wasim/bizOS`** — that is the development checkout, and decoupling the two was the point of
  this cutover. To ship: `git -C /home/wasim/bizos-production pull`,
  `pnpm install --frozen-lockfile`, `pnpm --filter @bizo/database prisma:migrate:deploy`,
  `pnpm build`, `sudo systemctl restart bizos-api bizos-web`, then
  `node scripts/ops/release-readiness.mjs`.
- **Never export `.env` into `next build`.** `NODE_ENV` from that file is what breaks it.
- `sudo` is passwordless on this host. Rollback for both services is one command, in the runbook.
- Running e2e on this machine needs `E2E_WEB_PORT` / `E2E_API_PORT` and a scratch `DATABASE_URL`;
  `playwright.config.ts` reads both. A `bizo_e2e` database exists on the local Postgres for exactly
  this. Without those, `reuseExistingServer` points the suite at production.
