# Production operations runbook

Status: Active for private beta

## Architecture

- Edge: Cloudflare DNS/TLS/CDN for `bizos.qloudihub.com` and `api.bizos.qloudihub.com`
- Apps: managed Docker services for Next.js web and NestJS API (Render or equivalent)
- Data: Prisma Postgres (`eu-central-1`), TLS required
- Email: transactional SMTP provider with verified sender domain
- Object storage: R2 Standard bucket `bizos-production` (private; application seam inactive)
- Inactive seams: Redis, BullMQ, application R2 PDF persistence

See [ADR-0015](../decisions/0015-managed-hosting-behind-cloudflare.md) and
[r2-object-storage.md](r2-object-storage.md).

## Deployment procedure

1. Confirm `main` CI is green for the target SHA.
2. Confirm tag `v0.1.0-beta.1` (or later) points at that SHA when releasing.
3. Ensure production secrets/variables are present.
4. Run `Production deploy` (`workflow_dispatch` or push to `main`).
5. The workflow:
   - runs the release gate
   - publishes `ghcr.io/<owner>/bizo-api:<sha>` and `bizo-web:<sha>`
   - creates/verifies a recovery point expectation (Prisma automated backups)
   - runs exactly one migration job: `pnpm --filter @bizo/database prisma:migrate:deploy`
   - validates R2 with a put/get/delete probe when credentials are present
   - deploys API, waits for `/api/v1/health`
   - deploys web, waits for `/`
6. Independently, run `Infrastructure validation` after rotating Cloudflare or R2 credentials.
7. Record the deployed SHA in the workflow summary.

Never run concurrent production migration jobs. The workflow concurrency group
`production-migration` enforces this.

## Rollback procedure

1. Identify the prior successful deploy SHA from GitHub Actions summaries or the release notes.
2. Re-run `Production deploy` with `rollback_to_sha` set to that SHA.
3. Rollback republishes and redeploys the prior web and API images together.
4. Do **not** automatically reverse database migrations. Prefer forward repair.
5. Confirm API and web health after rollback.
6. Preserve failed delivery records; retry email only after SMTP health returns.
7. Record the rollback event in the workflow summary and an operations note.

## Database restoration

1. List Prisma Postgres backups in the Prisma console for project `bizOS`.
2. Restore to a new branch/database when available; do not overwrite production blindly.
3. Point a preview environment at the restored database and verify migrations/status.
4. Only after verification, cut over production credentials through GitHub environment secrets.
5. Rotate the previous connection string after cutover.

## Secret rotation

1. Generate new `AUTH_SECRET` and `INTERNAL_AUTH_SECRET` independently (min 32 bytes each).
2. Update production environment secrets.
3. Redeploy web and API together so internal assertions stay compatible.
4. Rotate `DATABASE_URL` by creating a new Prisma connection string, updating the secret,
   redeploying, then deleting the old connection string.
5. Rotate SMTP and hosting credentials in the provider first, then GitHub secrets, then redeploy.

## SMTP outage response

1. Confirm provider status and DNS (SPF/DKIM/DMARC).
2. Quotation finalization may succeed while delivery fails; delivery rows stay `FAILED`.
3. Do not mass-resend until SMTP accepts mail again.
4. After recovery, resend from the quotation UI for affected deliveries only.

## Cloudflare / DNS incident response

1. Verify only `bizos.qloudihub.com` and `api.bizos.qloudihub.com` were changed.
2. Confirm SSL mode Full (strict) and Always Use HTTPS.
3. Purge cache for those hosts only if a bad static asset was cached.
4. Re-run `Cloudflare edge bootstrap` if header or DNS records drifted.

## Application outage response

1. Check GitHub Actions deployment summary for the current SHA.
2. Check API `/api/v1/health` and web `/`.
3. Inspect managed host logs for 5xx without dumping secrets.
4. Roll back to the previous SHA if the new release is at fault and schema remains compatible.
5. If the database is unavailable, keep apps stopped or in maintenance until Postgres is restored.

## Monitoring checklist

- Web uptime on `https://bizos.qloudihub.com/`
- API uptime on `https://api.bizos.qloudihub.com/api/v1/health`
- GitHub Actions deployment conclusions
- SMTP failure visibility via delivery status in the app
- Prisma automated backup presence
- Deployed commit SHA recorded per release
