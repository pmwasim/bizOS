# bizOS n8n Setup Runbook

**Local n8n (in-repo):** Docker Compose profile `ops`, container `bizos-n8n`,
`http://127.0.0.1:5678`.  
**Host ops n8n:** Docker container `qh-n8n` on the Ubuntu qloudihub stack (same webhook paths).  
**Policy:** [n8n-integration-policy.md](./n8n-integration-policy.md)

## Quick start

```bash
# 1. Start Mailpit (already in the default compose stack) and n8n
docker compose --env-file .env up -d postgres redis mailpit
pnpm ops:n8n:up

# 2. Put the shared HMAC in .env (bizOS) — compose passes it to n8n as BIZOS_WEBHOOK_SECRET
#    N8N_WEBHOOK_SECRET=<openssl rand -hex 32>
#    N8N_CUSTOMIZATION_WEBHOOK_URL=http://127.0.0.1:5678/webhook/bizos/customization-request
#    N8N_OPS_WEBHOOK_URL=http://127.0.0.1:5678/webhook/bizos/ops-event
#    N8N_CI_WEBHOOK_URL=http://127.0.0.1:5678/webhook/bizos/ci-failure

# 3. Import templates and activate them
pnpm ops:n8n:import -- --activate

# 4. Prove signed webhooks and Mailpit delivery
pnpm ops:n8n:verify
```

Git templates always ship with `"active": false`. Activation is a runtime step against a running
n8n, not a committed JSON flag.

## Workflow catalog

| Export                              | n8n name                           | Trigger                                             | Purpose                                                                   |
| ----------------------------------- | ---------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------- |
| `customization-request-notify.json` | bizOS Customization Request Notify | Webhook `POST /webhook/bizos/customization-request` | Ops alert when a tenant submits a customization request                   |
| `ops-event-notify.json`             | bizOS Ops Event Notify             | Webhook `POST /webhook/bizos/ops-event`             | Failed email, onboarding applied, System Admin assignment/template events |
| `ci-failure-notify.json`            | bizOS CI Failure Notify            | Webhook `POST /webhook/bizos/ci-failure`            | CI/deploy failure push from GitHub Actions or local scripts               |
| `github-actions-poll.json`          | bizOS GitHub Actions Poll          | Cron every 15 min                                   | Poll GitHub API for new bizOS workflow failures (**no inbound webhook**)  |
| `health-monitor.json`               | bizOS Health Monitor               | Cron every 5 min                                    | Check production API + web health; alert only when degraded               |

Delivery is Mailpit (`BIZOS_OPS_MAILPIT_URL`, default `http://mailpit:8025` on the compose network)
or `BIZOS_OPS_ALERT_WEBHOOK_URL`. Inbox: `http://127.0.0.1:8025`.

## CI/CD integration

### Option A — GitHub Actions webhook (requires reachable URL)

GitHub-hosted runners cannot POST to `127.0.0.1`. Use one of:

- Self-hosted runner on this machine with
  `N8N_CI_WEBHOOK_URL=http://127.0.0.1:5678/webhook/bizos/ci-failure`
- Reverse tunnel exposing the n8n webhook path
- **Option B** below (recommended for $0 / localhost)

Repository secrets (optional — unset skips notify jobs):

| Secret               | Value                                                      |
| -------------------- | ---------------------------------------------------------- |
| `N8N_CI_WEBHOOK_URL` | Full webhook URL for **bizOS CI Failure Notify**           |
| `N8N_WEBHOOK_SECRET` | Shared HMAC secret (matches `BIZOS_WEBHOOK_SECRET` in n8n) |

Wired in:

- `.github/workflows/ci.yml` — `notify-n8n` job on quality gate failure
- `.github/workflows/production-health.yml` — `notify-n8n` job on probe failure
- `.github/workflows/production-release-gate.yml` — `notify-n8n` job on gate failure

### Option B — Poll from local n8n (recommended for $0 / localhost)

1. Optional: set `N8N_GITHUB_TOKEN` (fine-grained PAT, Actions: Read on `pmwasim/bizOS`) to raise
   rate limits. Public-repo polling works without a token.
2. Activate **bizOS GitHub Actions Poll**
3. No GitHub secrets required; works entirely from localhost

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

| Variable                      | Used by             | Description                                                              |
| ----------------------------- | ------------------- | ------------------------------------------------------------------------ |
| `BIZOS_WEBHOOK_SECRET`        | Webhook workflows   | HMAC verification; must match bizOS `N8N_WEBHOOK_SECRET`                 |
| `BIZOS_OPS_MAILPIT_URL`       | Deliver Alert nodes | Default `http://mailpit:8025` on compose; host n8n needs a reachable URL |
| `BIZOS_OPS_ALERT_EMAIL`       | Deliver Alert nodes | Mailpit recipient (default `ops@bizos.local`)                            |
| `BIZOS_OPS_ALERT_WEBHOOK_URL` | Deliver Alert       | Optional JSON POST alternative to Mailpit                                |
| `GITHUB_TOKEN`                | GitHub Actions Poll | Optional PAT with `actions:read`; compose maps `N8N_GITHUB_TOKEN`        |
| `BIZOS_API_HEALTH_URL`        | Health Monitor      | Default: `https://api.bizos.qloudihub.com/api/v1/health`                 |
| `BIZOS_WEB_HEALTH_URL`        | Health Monitor      | Default: `https://bizos.qloudihub.com/`                                  |
| `NODE_FUNCTION_ALLOW_BUILTIN` | Code nodes          | `crypto,http,https` — required for HMAC verify and Mailpit delivery      |

Compose passes `N8N_WEBHOOK_SECRET` from `.env` into the n8n container as `BIZOS_WEBHOOK_SECRET`.
Restart n8n after changing it:

```bash
docker compose --env-file .env --profile ops up -d n8n
```

Ubuntu `qh-n8n`:

```bash
cd /home/wasim/Projects/qloudihub/ops/stack
# edit .env — add BIZOS_WEBHOOK_SECRET, optional GITHUB_TOKEN, BIZOS_OPS_MAILPIT_URL,
# and NODE_FUNCTION_ALLOW_BUILTIN=crypto,http,https
docker compose restart n8n
N8N_CONTAINER=qh-n8n pnpm ops:n8n:import -- --activate
```

## Import / re-import

```bash
pnpm ops:n8n:import                 # import all templates (inactive)
pnpm ops:n8n:import -- --dry-run    # preview only
pnpm ops:n8n:import -- --activate   # import + activate
```

Re-import updates a workflow that already exists with the same name (the n8n id is reused).
Code nodes need `NODE_FUNCTION_ALLOW_BUILTIN=crypto,http,https` (set in compose for `bizos-n8n`).

## Activation checklist

1. Start n8n (`pnpm ops:n8n:up`) with `N8N_WEBHOOK_SECRET` in `.env`
2. Import and activate (`pnpm ops:n8n:import -- --activate`)
3. Point bizOS at the webhooks (`N8N_CUSTOMIZATION_WEBHOOK_URL`, `N8N_OPS_WEBHOOK_URL`,
   `N8N_CI_WEBHOOK_URL`)
4. Verify: `pnpm ops:n8n:verify` (signed POSTs + Mailpit subjects)
5. Optional: execute **bizOS Health Monitor** and **bizOS GitHub Actions Poll** once in the n8n UI

## Kill switch

- bizOS: unset `N8N_CUSTOMIZATION_WEBHOOK_URL` / `N8N_OPS_WEBHOOK_URL` / `N8N_CI_WEBHOOK_URL`
- n8n: deactivate workflows in UI or `docker compose --profile ops stop n8n`
- GitHub: remove `N8N_CI_WEBHOOK_URL` secret

No API redeploy is required when unsetting env vars, besides restarting the API process so it
rereads the environment.
