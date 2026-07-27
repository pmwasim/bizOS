# Admin approval packet — operational closure follow-ups

Date: 2026-07-27  
Updated: after #22 merge + edge bootstrap success

Autonomous free-tier work continues. These items need a human with dashboard ownership.

## 1) Cloudflare API token rotation (security) + free Workers health deploy

- Provider: Cloudflare **Free**
- Status: **still required**
  - Edge bootstrap succeeds for DNS Edit (CNAMEs DNS-only OK)
  - Token lacks Zone Settings Edit (SSL/HTTPS skip) and Workers (deploy run `30294011182` → auth
    `10000`)
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
  KV already created: `bizos-health-status` (`b1302b5221a14f58a38200caecbe88e1`)

## 2) Prisma managed backups (Starter)

- Provider: Prisma Postgres
- Evidence: Primary `db_cms34xzjv4gsfzmf97wvbucqv` backup list was **empty** on 2026-07-27
- Docs: automated daily snapshots are on Starter/Pro/Business only; no PITR
- Recommendation: approve **Starter** (~$10/month class) for 7-day daily snapshots once private-beta
  data must be recoverable without manual `pg_dump`
- Until approved: interim recovery = encrypted `pg_dump` of the direct connection string
- Payment details required: yes for Starter

## 3) Delete ephemeral Prisma Postgres branch databases (free-tier pressure)

- Keep only Primary `db_cms34xzjv4gsfzmf97wvbucqv`
- Candidates (non-default, disposable PR/dependabot envs) — **confirm before delete**:
  - `cursor/release-p1-fixes`
  - `dependabot/github_actions/*` (several)
  - `dependabot/npm_and_yarn/typescript-7.0.2`
  - `dependabot/docker/apps/{api,web}/node-26.5.0-bookworm-slim`
  - `cursor/ops-status-update`
  - `cursor/infra-revalidate-765f`
  - `cursor/ops-closure-private-beta`
- Irreversible; not executed autonomously

## Already closed

- Cutover QA tenants removed ([qa-cutover-cleanup-evidence.md](./qa-cutover-cleanup-evidence.md))
- PR #22 merged (`2c8734f`) — monitoring docs + health workflows + Worker source
- `WEB_ORIGIN_HOST` / `API_ORIGIN_HOST` corrected to Render hosts; edge bootstrap green
- Production health workflow green on `main`
- Live smoke: web 200, API ok, unauth PDF 401, DNS-only CNAMEs
- Full report: [operational-closure-report.md](./operational-closure-report.md)
