# Production monitoring and free-tier review

Status: Active for private beta

## Continuous checks

| Signal                | How                                                                      | Cadence                                       |
| --------------------- | ------------------------------------------------------------------------ | --------------------------------------------- |
| Web uptime            | `GET https://bizos.qloudihub.com/` expect 200                            | CF Worker cron + `Production health` workflow |
| API health            | `GET https://api.bizos.qloudihub.com/api/v1/health` expect `status:"ok"` | CF Worker cron + `Production health` workflow |
| Failed deploys        | GitHub Actions → Production deploy conclusions                           | On each deploy                                |
| SMTP / email failures | Quotation UI delivery status (`SENT` / `FAILED`)                         | Per send; review weekly                       |
| Deployed SHA          | Production deploy job summary                                            | Per release                                   |
| Prisma backups        | Prisma Console / MCP `list_prisma_postgres_backups`                      | Weekly until paid backups proven              |

## Cloudflare Free resources (in use)

| Resource                    | Status      | Notes                                                                        |
| --------------------------- | ----------- | ---------------------------------------------------------------------------- |
| DNS (zone `qloudihub.com`)  | Active      | `bizos` / `api.bizos` CNAME **DNS-only** to Render                           |
| R2 `bizos-production`       | Active      | Probe-only; app PDF seam inactive                                            |
| Workers Free `bizos-health` | Provisioned | Cron `*/30` + KV `bizos-health-status` — see `ops/cloudflare-health-worker/` |
| Workers KV                  | Active      | Namespace id `b1302b5221a14f58a38200caecbe88e1`                              |

### Not feasible on Free (do not enable without Admin approval)

| Resource                                          | Why blocked                             |
| ------------------------------------------------- | --------------------------------------- |
| Cloudflare Health Checks / Smart Shield health    | Free = 0 checks (Pro+)                  |
| Orange-cloud / proxied CNAMEs to `*.onrender.com` | “DNS points to prohibited IP”           |
| Paid Smart Shield + Argo                          | Starts ~$5/mo — escalate only if needed |

## Scheduled health workflow

1. **Cloudflare Worker** (`ops/cloudflare-health-worker`): cron every 30 minutes; last result in KV;
   `workers.dev` `/status`. Deploy via **Deploy Cloudflare health worker**.
2. **GitHub Actions** `.github/workflows/production-health.yml`: `schedule` every 30 minutes +
   `workflow_dispatch`; fails red on repeated probe failure (free-tier cold-start retries included).

## SMTP failure visibility

- Application persists `document_deliveries.status`.
- Failed sends remain visible on the quotation page; do not mass-resend until provider healthy.
- Provider: Resend HTTPS path when `SMTP_URL` host is `smtp.resend.com` (Render free blocks SMTP
  ports).

## Database recovery documentation

See [production-runbook.md](./production-runbook.md) § Database restoration (verified 2026-07-27).

Summary of verified state:

- Automated managed snapshots are documented for **Starter / Pro / Business** only.
- Authenticated Primary backup list on 2026-07-27 returned **zero** snapshots.
- PITR is **not** currently offered; restore creates a **new** database from a snapshot when
  available.
- Interim: `pg_dump` via direct connection string when a manual recovery file is required.

## Cloudflare token rotation

See [cloudflare-token-rotation.md](./cloudflare-token-rotation.md).

## Monthly free-tier usage review

Perform on the first business day of each month. Escalate only when limits threaten private-beta
availability.

### Render (free)

- Dashboard → bizos-web / bizos-api: hours used, spin-down / cold starts, deploy failures
- Confirm auto-deploy still off; deploys only via Production deploy workflow
- Custom domain quota (2/2 used)

### Prisma Postgres

- Console → Primary: storage used, operations used vs Free allowance
- Backup list empty? Re-check; if still empty and production traffic exists, open Admin packet for
  **Starter** ($10/mo class) for 7-day daily snapshots
- Delete unused preview/dependabot databases to stay under Free database count

### Cloudflare (Free)

- DNS: confirm `bizos` / `api.bizos` still **DNS-only** to Render
- R2 `bizos-production`: Class A/B ops and storage; app PDF seam inactive
- Workers Free: `bizos-health` cron success in Workers metrics; KV writes ≪ 1k/day
- Do **not** enable paid Health Checks / Argo unless Admin-approved

### Resend

- Daily send count vs free tier
- Domain `bizos.qloudihub.com` verification still green
