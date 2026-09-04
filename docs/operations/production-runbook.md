# Production operations runbook

Status: Active for private beta

## 🛑 KILL SWITCH — stop all automated deployment right now

```bash
scripts/ops/deploy-kill-switch.sh on
```

(or, if that script is ever unreachable for some reason:
`touch /home/wasim/bizos-backups/DEPLOY_HALT`)

This works **immediately**, including while a deploy is already running — it's checked at the start
of every deploy script and again at the last safe point before the database or a live service is
touched, so a deploy in flight stops at the next checkpoint instead of finishing. Production is left
exactly as it is; nothing is torn down by hitting this. Turn automation back on with
`scripts/ops/deploy-kill-switch.sh off`. `scripts/ops/deploy-kill-switch.sh status` shows the
current state in plain language — kill switch, circuit breaker, and the last few deploys — at any
time.

## Architecture

- Host: a single Ubuntu desktop box (`/home/wasim`) is the authoritative production host — see
  [ADR-0022](../decisions/0022-ubuntu-production-hosting.md). **Render is retired**; ignore any
  `RENDER_*` instructions found in older history.
- Edge: `cloudflared` (Cloudflare Tunnel) routes `bizos.qloudihub.com` → `http://localhost:3000`. No
  public `api.bizos.qloudihub.com` — the API is internal-only (`http://127.0.0.1:3001`), reached by
  the web app's BFF layer (`API_INTERNAL_URL`), never exposed directly.
- Apps: `bizos-api.service` / `bizos-web.service` (systemd, `Restart=always`), running the
  production build out of `/home/wasim/bizos-production` — a separate git checkout of this repo, not
  the dev checkout. See [ubuntu-production-cutover.md](ubuntu-production-cutover.md) for how that
  checkout is laid out.
- Data: PostgreSQL in Docker (`bizo-postgres-1`), `postgresql://bizo@localhost:5432/bizo`, FORCE RLS
  on business-scoped tables.
- Email: Resend HTTPS when `SMTP_URL` host is `smtp.resend.com`.
- Object storage: R2 Standard bucket `bizos-production` (private; application seam inactive).
- Inactive seams: Redis, BullMQ, application R2 PDF persistence.
- Watchdog: `~/machine-monitor` (systemd `--user` timer, every 30 min) restarts
  `bizos-api`/`bizos-web` if they're enabled but down, scans their journald output for `error`
  lines, runs a daily `pnpm audit --audit-level=high` against `bizos-production`'s locked
  dependencies, and reports the autodeploy kill switch/circuit breaker state read-only. Zero-cost,
  rule-based, no AI API calls — see `~/machine-monitor/README.md` on the host.
- Deploy: `bizos-autodeploy.timer` (systemd `--user`, every 15 min) — see Deployment procedure
  below. Fully autonomous once activated; the kill switch above stops it at any time.

See [ADR-0015](../decisions/0015-managed-hosting-behind-cloudflare.md),
[ADR-0022](../decisions/0022-ubuntu-production-hosting.md),
[r2-object-storage.md](r2-object-storage.md), [monitoring.md](monitoring.md), and
[cloudflare-token-rotation.md](cloudflare-token-rotation.md).

## Deployment procedure

**Deploys are autonomous.** No CI-to-Ubuntu pipeline exists (GitHub Actions cannot reach this host),
but no human approves each deploy either — see
[ADR-0027](../decisions/0027-autonomous-gated-production-deploy.md) for why.
`bizos-autodeploy.timer` (systemd `--user`, every 15 min) polls `origin/main`; when it's moved, it
runs `scripts/ops/deploy-production.sh` for you. Safety comes from the gates below, not from someone
watching:

- **Quality gate**: `pnpm check` (lint/typecheck/test/build) must pass before anything
  production-facing is touched. Never deploys on red.
- **Blast-radius cap**: won't auto-deploy more than 5 commits past what's currently live in one jump
  (`MAX_AUTO_COMMITS` in `scripts/ops/autodeploy.sh`). A bigger gap is skipped, logged, and waits
  for a deliberate manual deploy.
- **Health + smoke verification**: `pnpm ops:release-readiness` against the public web origin and
  the internal API after every deploy.
- **Automatic rollback**: any verification failure rebuilds and restarts the previous commit, then
  re-verifies that. A "success" always means the new code is actually live and healthy.
- **Circuit breaker**: two consecutive automatic failures trip
  `/home/wasim/bizos-backups/DEPLOY_CIRCUIT_TRIPPED` and stop the timer from retrying until a human
  clears it (`scripts/ops/deploy-kill-switch.sh reset-circuit`) or a manual deploy succeeds — a
  broken pipeline gets two tries against production, not an unlimited loop.
- **Kill switch**: see the top of this document. Stops everything, immediately, including
  mid-deploy.

### One-time activation

The timer does nothing (`scripts/ops/deploy-kill-switch.sh status` will say "NOT YET ACTIVATED")
until:

```bash
scripts/ops/deploy-kill-switch.sh activate
```

which itself refuses if production is more than the blast-radius cap behind `origin/main` — this is
what stops the very first tick of this system from silently shipping a backlog nobody chose to
release.

**Activated 2026-09-02.** Production was caught up to `origin/main`
(`7c2c3ccee127a032b8141d61b256f2232bb52d8a`) with a deliberate manual
`deploy-production.sh --sha … --confirm` (four additive Sprint 7–8 migrations + release-readiness
14/14), then `deploy-kill-switch.sh activate`. The timer is live; `status` should report
“activated”. If production ever falls more than `MAX_AUTO_COMMITS` (5) behind again, the timer skips
until another deliberate manual catch-up — it will not self-swallow a large backlog.

To re-arm after a fresh checkout or if `.autodeploy-activated` is missing:

```bash
scripts/ops/deploy-production.sh --sha $(git -C /home/wasim/bizos-production rev-parse origin/main) --confirm
scripts/ops/deploy-kill-switch.sh activate
```

### Manual / emergency deploy

The engine works standalone too, for a deliberate one-off (e.g. during an incident, or before
activating the timer):

```bash
scripts/ops/deploy-production.sh --sha <40-hex-sha> --confirm
```

`--confirm` here is an accident guard (no bare invocation fires this by tab-completion + enter), not
a permission step — same script, same gates, same rollback, whether it's the timer or a person
calling it. `--override-halt` pushes a manual deploy through an active kill switch, for the rare
case where a human deliberately needs to act while automation is stopped.

Never run two deploys at once — `autodeploy.sh` takes a lock (`flock`) so overlapping timer ticks
skip rather than collide, but a manual invocation while the timer is mid-deploy is still a race;
check `scripts/ops/deploy-kill-switch.sh status` first.

## Rollback procedure

Rollback is automatic on a failed verification (see above) — nothing to do. To roll back manually to
a specific SHA:

```bash
scripts/ops/deploy-production.sh --rollback <40-hex-sha> --confirm
```

Rollback never runs a database migration — migrations are additive-only by project convention, so
the previous code stays compatible with the current schema (**prefer forward repair**, never an
automatic migration reversal). Confirm API and web health after rollback; preserve failed email
delivery records and retry only after SMTP health returns. If a rollback itself fails,
`deploy-production.sh` writes the kill-switch halt file directly (production may be down — this
needs a human, not another automatic retry).

### Current rollback target

Read `/home/wasim/bizos-backups/deploy-history.log` on the host, or
`git -C /home/wasim/bizos-production log -1` for the SHA currently live.

## Database restoration (verified 2026-07-27)

### Evidence

- Authenticated Prisma Management API / MCP against Primary `db_cms34xzjv4gsfzmf97wvbucqv` listed
  **zero** managed backups (`list_prisma_postgres_backups` → empty).
- On-demand backup creation is **not** supported by the platform API.
- Official docs: automated daily snapshots exist on **Starter / Pro / Business** plans only
  (Starter/Pro retain 7 days; Business 30 days). Snapshots run on days with activity.
- **Point-in-time recovery (PITR) is not available** today; future fine-grained restore is
  documented as planned, not shipped.
- Therefore: **do not claim managed backup readiness** until the Primary backup list shows at least
  one `completed` snapshot (typically after upgrading off Free and waiting for a daily snapshot).

### When managed snapshots exist

1. Prisma Console → project `bizOS` → Primary → **Backups**, or MCP `list_prisma_postgres_backups`.
2. Restore with **Create recovery** / MCP `create_prisma_postgres_recovery` into a **new** database
   name (never overwrite Primary in-place).
3. Create a connection string for the recovered DB; point a preview environment at it; run
   `prisma migrate status` and smoke read-only checks.
4. Only after verification, cut over production `DATABASE_URL` (GitHub environment + Render runtime)
   and redeploy API/web together.
5. Rotate/retire the previous connection string after cutover.

### Interim recovery without managed snapshots

1. Use a **direct** Prisma Postgres connection string (not the pooled URL) with Postgres 17
   `pg_dump` to create an encrypted offline dump stored outside the app filesystem.
2. Restore with `pg_restore` / `psql` into a newly provisioned Prisma database.
3. Validate migrations and application smoke before any production cutover.
4. Open an Admin approval packet for **Prisma Starter** if private-beta needs managed daily
   snapshots.

### RLS note for operators

Business-scoped tables use `FORCE ROW LEVEL SECURITY` with `tenant_id = bizo_current_tenant_id()`
and `business_id = bizo_current_business_id()`. Administrative SQL must
`set_config('app.tenant_id', …, true)` and `set_config('app.business_id', …, true)` inside the same
transaction.

## Secret rotation

1. Generate new `AUTH_SECRET` and `INTERNAL_AUTH_SECRET` independently (min 32 bytes each).
2. Update production environment secrets.
3. Redeploy web and API together so internal assertions stay compatible.
4. Rotate `DATABASE_URL` by updating `/home/wasim/bizos-production/.env` and restarting
   `bizos-api`/`bizos-web`, then deleting the old credential.
5. Rotate SMTP credentials in the provider first, then `/home/wasim/bizos-production/.env`, then
   restart.
6. Cloudflare API token: follow [cloudflare-token-rotation.md](cloudflare-token-rotation.md).

## SMTP outage response

1. Confirm Resend status and DNS (SPF/DKIM/DMARC) for `bizos.qloudihub.com`.
2. Quotation finalization may succeed while delivery fails; delivery rows stay `FAILED`.
3. Do not mass-resend until the provider accepts mail again.
4. After recovery, resend from the quotation UI for affected deliveries only.

## Cloudflare / DNS incident response

1. Verify only `bizos.qloudihub.com` was changed (no public `api.bizos.qloudihub.com` record exists
   — the API is internal-only).
2. Confirm the tunnel (`cloudflared.service`) is active and its ingress still points at
   `http://localhost:3000`.
3. Confirm SSL mode Full (strict) and Always Use HTTPS when Zone Settings Edit is available.
4. Re-run `Cloudflare edge bootstrap` if header or DNS records drifted.
5. After any token exposure, rotate per
   [cloudflare-token-rotation.md](cloudflare-token-rotation.md).

## Application outage response

0. If the outage might be deploy-related (a deploy just ran, or one might be running),
   `scripts/ops/deploy-kill-switch.sh on` first — stops any deploy in flight and prevents the
   autodeploy timer from making things worse while you investigate.
1. Check `/home/wasim/bizos-backups/deploy-history.log` for the current SHA and last deploy result.
2. Check API `http://127.0.0.1:3001/api/v1/health` and web `https://bizos.qloudihub.com/` (or wait
   for the scheduled `Production health` GitHub workflow / `~/machine-monitor` tick).
3. `journalctl -u bizos-api -u bizos-web` for 5xx/errors, without dumping secrets.
4. Roll back with `scripts/ops/deploy-production.sh --rollback <sha> --confirm` if the new release
   is at fault and the schema remains compatible.
5. If the database is unavailable, `sudo systemctl stop bizos-api bizos-web` until Postgres is
   restored — do not leave the app serving against a dead database.

## Monitoring checklist

See [monitoring.md](monitoring.md).

- Web uptime on `https://bizos.qloudihub.com/`
- API liveness at `http://127.0.0.1:3001/api/v1/health` (internal only — no public API hostname)
- Scheduled `Production health` GitHub workflow + `~/machine-monitor` (30-min tick: service
  liveness, production error-log scan, memory/disk/CPU; daily: dependency audit)
- SMTP failure visibility via delivery status in the app
- Deployed commit SHA recorded in `/home/wasim/bizos-backups/deploy-history.log`
- Autodeploy kill switch / circuit breaker state — `scripts/ops/deploy-kill-switch.sh status`, also
  surfaced read-only in `~/machine-monitor`'s status

## Cutover QA data

Cleanup evidence: [qa-cutover-cleanup-evidence.md](qa-cutover-cleanup-evidence.md)  
Replay SQL: `scripts/ops/cleanup-cutover-qa.sql`
