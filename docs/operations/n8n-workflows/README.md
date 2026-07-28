# bizOS n8n workflow exports

Sanitized n8n workflow templates for the local qloudihub stack (`qh-n8n` @ `127.0.0.1:5678`).

| File                                | Purpose                                                   |
| ----------------------------------- | --------------------------------------------------------- |
| `customization-request-notify.json` | Webhook when tenants submit customization requests        |
| `ci-failure-notify.json`            | Webhook for CI/deploy failures (GitHub Actions or local)  |
| `github-actions-poll.json`          | Cron poll of GitHub Actions — no inbound webhook required |
| `health-monitor.json`               | Cron production API/web health checks                     |

All files ship with `"active": false`. See [n8n-setup-runbook.md](../n8n-setup-runbook.md).

```bash
pnpm ops:n8n:import
```
