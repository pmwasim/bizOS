# bizOS n8n workflow exports

Sanitized n8n workflow templates. Import target is local compose `bizos-n8n`
(`docker compose --profile ops`) or Ubuntu `qh-n8n`.

| File                                | Purpose                                                           |
| ----------------------------------- | ----------------------------------------------------------------- |
| `customization-request-notify.json` | Webhook when tenants submit customization requests                |
| `ops-event-notify.json`             | Webhook for failed email, onboarding, and System Admin ops events |
| `ci-failure-notify.json`            | Webhook for CI/deploy failures (GitHub Actions or local)          |
| `github-actions-poll.json`          | Cron poll of GitHub Actions — no inbound webhook required         |
| `health-monitor.json`               | Cron production API/web health checks                             |

All files ship with `"active": false`. Activate at runtime. See
[n8n-setup-runbook.md](../n8n-setup-runbook.md).

```bash
pnpm ops:n8n:up
pnpm ops:n8n:import -- --activate
pnpm ops:n8n:verify
```
