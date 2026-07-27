# Admin approval packet — operational closure follow-ups

Date: 2026-07-27

Autonomous free-tier work continues. These items need a human with dashboard ownership.

## 1) Cloudflare API token rotation (security) + free Workers health deploy

- Provider: Cloudflare **Free**
- Action: Create replacement least-privilege User API Token:
  - Zone `qloudihub.com`: Zone Read, DNS Edit, Zone Settings Edit (+ optional Transform Rules)
  - Account: Workers Scripts Edit, Workers KV Storage Edit, Account Settings Read
- Update GitHub secret `CLOUDFLARE_API_TOKEN` via `gh secret set` (stdin; never paste into chat)
- Run **Infrastructure validation**, then **Cloudflare edge bootstrap**
- Confirm CNAMEs remain DNS-only (`proxied=false`) — do **not** orange-cloud onrender targets
- Run **Deploy Cloudflare health worker** (Workers Free cron + KV). Health Checks are paid-only; do
  not buy Pro for monitoring.
- Revoke the prior token (appeared in an intermediate automation log)
- Expected pricing: free
- Procedure: [cloudflare-token-rotation.md](./cloudflare-token-rotation.md)  
  Worker: `ops/cloudflare-health-worker/`

## 2) Prisma managed backups (Starter)

- Provider: Prisma Postgres
- Evidence: Primary `db_cms34xzjv4gsfzmf97wvbucqv` backup list was **empty** on 2026-07-27
- Docs: automated daily snapshots are on Starter/Pro/Business only; no PITR
- Recommendation: approve **Starter** (~$10/month class) for 7-day daily snapshots once private-beta
  data must be recoverable without manual `pg_dump`
- Until approved: interim recovery = encrypted `pg_dump` of the direct connection string
- Payment details required: yes for Starter

## Already closed this session

- Cutover QA tenants removed (see
  [qa-cutover-cleanup-evidence.md](./qa-cutover-cleanup-evidence.md))
- Production health workflow added
- Free Cloudflare KV namespace `bizos-health-status` created; Worker source ready to deploy
- Runbook recovery section updated with verified empty-backup evidence
