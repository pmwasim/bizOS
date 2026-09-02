# Production operations runbook

Status: Active for private beta

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
  lines, and runs a daily `pnpm audit --audit-level=high` against `bizos-production`'s locked
  dependencies. Zero-cost, rule-based, no AI API calls — see `~/machine-monitor/README.md` on the
  host.

See [ADR-0015](../decisions/0015-managed-hosting-behind-cloudflare.md),
[ADR-0022](../decisions/0022-ubuntu-production-hosting.md),
[r2-object-storage.md](r2-object-storage.md), [monitoring.md](monitoring.md), and
[cloudflare-token-rotation.md](cloudflare-token-rotation.md).

## Deployment procedure

There is no CI-to-Ubuntu automatic pipeline — GitHub Actions cannot reach this host, and per
[ADR-0022](../decisions/0022-ubuntu-production-hosting.md) and AGENTS.md, a human decides what
ships. `scripts/ops/deploy-production.sh` (run **on the Ubuntu host**, from the dev checkout)
automates everything downstream of that decision:

1. Confirm `main` CI is green for the target SHA (the GitHub `Production release gate` workflow —
   `workflow_dispatch`, reuses the same `pnpm check` + e2e suite — is one way to validate a
   candidate without touching the host at all).
2. Run, from `/home/wasim/bizOS`:

   ```bash
   scripts/ops/deploy-production.sh --sha <40-hex-sha> --confirm
   ```

   `--confirm` is required — this is a human-triggered command, never scheduled. The script:
   - refuses a SHA that isn't an ancestor of `origin/main` (only ships reviewed, merged commits);
   - checks available memory/swap before every build step and aborts rather than risk an OOM on a
     shared box;
   - `pg_dump`s the production database before touching it;
   - checks out the SHA in `/home/wasim/bizos-production`, installs, and runs `pnpm check` as a hard
     gate — **never deploys on red**;
   - builds web and api (sequentially, `NODE_ENV=production`), runs `prisma migrate deploy`,
     restarts `bizos-api` then `bizos-web` in order, waits for each to answer its health check;
   - verifies with `pnpm ops:release-readiness` against the public web origin and the internal API;
   - **automatically rolls back** to the previous commit (rebuild + restart + reverify) if
     verification fails, and exits non-zero either way so a "success" always means it's actually
     live;
   - appends a record to `/home/wasim/bizos-backups/deploy-history.log`.

3. Record the deployed SHA (the script's own output, plus a journal entry per AGENTS.md).

Never run two deploys at once on this box — there is no lock beyond "don't do that"; this is a
single operator, single-host system, not a fleet.

## Rollback procedure

Rollback is automatic on a failed verification (see above). To roll back manually to a specific SHA:

```bash
scripts/ops/deploy-production.sh --rollback <40-hex-sha> --confirm
```

Rollback never runs a database migration — migrations are additive-only by project convention, so
the previous code stays compatible with the current schema (**prefer forward repair**, never an
automatic migration reversal). Confirm API and web health after rollback; preserve failed email
delivery records and retry only after SMTP health returns.

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

## Cutover QA data

Cleanup evidence: [qa-cutover-cleanup-evidence.md](qa-cutover-cleanup-evidence.md)  
Replay SQL: `scripts/ops/cleanup-cutover-qa.sql`
