# Production operations runbook

Status: Active for private beta

## Architecture

- Edge: Cloudflare DNS/TLS for `bizos.qloudihub.com` and `api.bizos.qloudihub.com` (**DNS-only**
  CNAMEs to Render; do not orange-cloud onrender targets)
- Apps: Render free Docker services `bizos-web` / `bizos-api` (auto-deploy off)
- Data: Prisma Postgres Primary `db_cms34xzjv4gsfzmf97wvbucqv` project `bizOS` (`eu-central-1`), TLS
  required, FORCE RLS on business-scoped tables
- Email: Resend HTTPS when `SMTP_URL` host is `smtp.resend.com` (Render free blocks SMTP ports)
- Object storage: R2 Standard bucket `bizos-production` (private; application seam inactive)
- Inactive seams: Redis, BullMQ, application R2 PDF persistence

See [ADR-0015](../decisions/0015-managed-hosting-behind-cloudflare.md),
[r2-object-storage.md](r2-object-storage.md), [monitoring.md](monitoring.md), and
[cloudflare-token-rotation.md](cloudflare-token-rotation.md).

## Deployment procedure

1. Confirm `main` CI is green for the target SHA.
2. Confirm tag `v0.1.0-beta.1` (or later) points at that SHA when releasing.
3. Ensure production secrets/variables are present.
4. Run `Production deploy` (`workflow_dispatch` or intentional ops trigger).
5. The workflow:
   - runs a **preflight** job that fails before any mutation if the target SHA is malformed,
     required hosting secrets (`RENDER_API_KEY`, `RENDER_API_SERVICE_ID`, `RENDER_WEB_SERVICE_ID`)
     are missing, or `DATABASE_URL` is missing while a migration would run
   - runs the release gate
   - publishes `ghcr.io/<owner>/bizo-api:<sha>` and `bizo-web:<sha>`
   - runs exactly one migration job: `pnpm --filter @bizo/database prisma:migrate:deploy`
   - validates R2 with a put/get/delete probe when credentials are present
   - deploys API/web from GitHub Docker (`commitId`), waits for health URLs
   - **fails the run** if hosting credentials are absent at deploy time, so a green workflow always
     means the hosting rollout actually completed
6. Independently, run `Infrastructure validation` after rotating Cloudflare or R2 credentials.
7. Record the deployed SHA in the workflow summary.

Never run concurrent production migration jobs. The workflow concurrency group
`production-migration` enforces this.

## Rollback procedure

1. Identify the prior successful deploy SHA from GitHub Actions summaries.
2. Re-run `Production deploy` with `rollback_to_sha` set to that SHA.
3. Rollback republishes and redeploys the prior web and API images together.
4. Do **not** automatically reverse database migrations. Prefer forward repair.
5. Confirm API and web health after rollback.
6. Preserve failed delivery records; retry email only after SMTP health returns.
7. Record the rollback event in the workflow summary and an operations note.

### Current rollback target

- Last known-good before PDF-proxy fix: `cbac407c70f581009aecb218594d32096b3bb636`
- Preferred current production target: tip of `main` after ops-closure merge (includes `#21`)

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
4. Rotate `DATABASE_URL` by creating a new Prisma connection string, updating GitHub + Render,
   redeploying, then deleting the old connection string.
5. Rotate SMTP and hosting credentials in the provider first, then GitHub secrets, then redeploy.
6. Cloudflare API token: follow [cloudflare-token-rotation.md](cloudflare-token-rotation.md).

## SMTP outage response

1. Confirm Resend status and DNS (SPF/DKIM/DMARC) for `bizos.qloudihub.com`.
2. Quotation finalization may succeed while delivery fails; delivery rows stay `FAILED`.
3. Do not mass-resend until the provider accepts mail again.
4. After recovery, resend from the quotation UI for affected deliveries only.

## Cloudflare / DNS incident response

1. Verify only `bizos.qloudihub.com` and `api.bizos.qloudihub.com` were changed.
2. Confirm records remain **DNS-only** (`proxied=false`) to Render origins.
3. Confirm SSL mode Full (strict) and Always Use HTTPS when Zone Settings Edit is available.
4. Re-run `Cloudflare edge bootstrap` if header or DNS records drifted.
5. After any token exposure, rotate per
   [cloudflare-token-rotation.md](cloudflare-token-rotation.md).

## Application outage response

1. Check GitHub Actions deployment summary for the current SHA.
2. Check API `/api/v1/health` and web `/` (or wait for `Production health` workflow).
3. Inspect managed host logs for 5xx without dumping secrets.
4. Roll back to the previous SHA if the new release is at fault and schema remains compatible.
5. If the database is unavailable, keep apps stopped or in maintenance until Postgres is restored.

## Monitoring checklist

See [monitoring.md](monitoring.md).

- Web uptime on `https://bizos.qloudihub.com/`
- API uptime on `https://api.bizos.qloudihub.com/api/v1/health`
- GitHub Actions deployment conclusions + scheduled `Production health`
- SMTP failure visibility via delivery status in the app
- Prisma backup list (do not claim ready while empty)
- Deployed commit SHA recorded per release
- Monthly free-tier review (Render, Prisma Postgres, R2, Resend)

## Cutover QA data

Cleanup evidence: [qa-cutover-cleanup-evidence.md](qa-cutover-cleanup-evidence.md)  
Replay SQL: `scripts/ops/cleanup-cutover-qa.sql`
