# bizOS n8n Setup Runbook

**Local n8n:** Docker container `qh-n8n` on `http://127.0.0.1:5678` (qloudihub stack).  
**Policy:** [n8n-integration-policy.md](./n8n-integration-policy.md)

## Quick start

```bash
# 1. Import all workflow templates (inactive)
pnpm ops:n8n:import

# 2. Set shared webhook secret in n8n (qloudihub stack .env or container env)
#    BIZOS_WEBHOOK_SECRET=<openssl rand -hex 32>

# 3. Activate workflows in n8n UI after replacing "Log Route" nodes with Slack/email

# 4. Wire bizOS API (local .env)
#    N8N_CUSTOMIZATION_WEBHOOK_URL=http://127.0.0.1:5678/webhook/bizos/customization-request
#    N8N_WEBHOOK_SECRET=<same as BIZOS_WEBHOOK_SECRET>

# 5. Test customization webhook
node scripts/ops/n8n-test-customization-webhook.mjs
```

## Workflow catalog

| Export                              | n8n name                           | Trigger                                             | Purpose                                                                  |
| ----------------------------------- | ---------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------ |
| `customization-request-notify.json` | bizOS Customization Request Notify | Webhook `POST /webhook/bizos/customization-request` | Ops alert when a tenant submits a customization request                  |
| `ci-failure-notify.json`            | bizOS CI Failure Notify            | Webhook `POST /webhook/bizos/ci-failure`            | CI/deploy failure push from GitHub Actions or local scripts              |
| `github-actions-poll.json`          | bizOS GitHub Actions Poll          | Cron every 15 min                                   | Poll GitHub API for new bizOS workflow failures (**no inbound webhook**) |
| `health-monitor.json`               | bizOS Health Monitor               | Cron every 5 min                                    | Check production API + web health                                        |

All exports ship with `"active": false`. Activate only after credential and notification routing
review.

## CI/CD integration

### Option A — GitHub Actions webhook (requires reachable URL)

GitHub-hosted runners cannot POST to `127.0.0.1`. Use one of:

- Self-hosted runner on this machine with
  `N8N_CI_WEBHOOK_URL=http://127.0.0.1:5678/webhook/bizos/ci-failure`
- Reverse tunnel (Cloudflare Tunnel, etc.) exposing n8n webhook path

Repository secrets (optional — unset skips notify jobs):

| Secret               | Value                                                      |
| -------------------- | ---------------------------------------------------------- |
| `N8N_CI_WEBHOOK_URL` | Full webhook URL for **bizOS CI Failure Notify**           |
| `N8N_WEBHOOK_SECRET` | Shared HMAC secret (matches `BIZOS_WEBHOOK_SECRET` in n8n) |

Wired in:

- `.github/workflows/ci.yml` — `notify-n8n` job on quality gate failure
- `.github/workflows/production-deploy.yml` — deploy success/failure notification

### Option B — Poll from local n8n (recommended for $0 / localhost)

1. Create a GitHub fine-grained PAT with **Actions: Read** on `pmwasim/bizOS`
2. Set `GITHUB_TOKEN` in n8n environment (qloudihub stack env file)
3. Activate **bizOS GitHub Actions Poll**
4. No GitHub secrets required; works entirely from localhost

### Local developer check with notify

```bash
export N8N_CI_WEBHOOK_URL=http://127.0.0.1:5678/webhook/bizos/ci-failure
export N8N_WEBHOOK_SECRET=<secret>
pnpm ops:check:n8n   # runs pnpm check; notifies n8n on failure
```

Manual notify:

```bash
pnpm ops:n8n:notify ci-failure --branch feature/foo --sha $(git rev-parse HEAD)
```

## n8n environment variables

| Variable               | Used by             | Description                                              |
| ---------------------- | ------------------- | -------------------------------------------------------- |
| `BIZOS_WEBHOOK_SECRET` | Webhook workflows   | HMAC verification; must match bizOS `N8N_WEBHOOK_SECRET` |
| `GITHUB_TOKEN`         | GitHub Actions Poll | PAT with `actions:read` on bizOS repo                    |
| `BIZOS_API_HEALTH_URL` | Health Monitor      | Default: `https://api.bizos.qloudihub.com/api/v1/health` |
| `BIZOS_WEB_HEALTH_URL` | Health Monitor      | Default: `https://bizos.qloudihub.com/`                  |

Add to qloudihub stack env and restart n8n:

```bash
cd /home/wasim/Projects/qloudihub/ops/stack
# edit .env — add BIZOS_WEBHOOK_SECRET, GITHUB_TOKEN
docker compose restart n8n
```

## Import / re-import

```bash
pnpm ops:n8n:import              # import all templates
pnpm ops:n8n:import -- --dry-run  # preview only
```

Re-import may create duplicate workflows in n8n; delete old copies in UI if needed.

## Activation checklist

1. Import workflows (`pnpm ops:n8n:import`)
2. Configure n8n env vars (`BIZOS_WEBHOOK_SECRET`, `GITHUB_TOKEN` if polling)
3. Replace **Log Route** Set nodes with Slack/email/ops channel nodes
4. Manual test:
   - Customization: `node scripts/ops/n8n-test-customization-webhook.mjs`
   - CI: `pnpm ops:n8n:notify ci-failure --dryRun` then without `--dryRun`
   - Health: execute **bizOS Health Monitor** manually in n8n UI
5. Toggle **Active** in n8n UI
6. Set bizOS API env vars for customization webhook (production via Render env)

## Kill switch

- bizOS: unset `N8N_CUSTOMIZATION_WEBHOOK_URL` / `N8N_CI_WEBHOOK_URL`
- n8n: deactivate workflows in UI
- GitHub: remove `N8N_CI_WEBHOOK_URL` secret

No redeploy required for bizOS API when unsetting env vars on Render (restart service to pick up
changes).
