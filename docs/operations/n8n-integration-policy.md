# n8n Integration Policy — bizOS

**Branch:** `feature/default-erp-onboarding-system-admin`  
**Date:** 2026-07-28  
**Phase:** 12 — integration policy + health assessment

## Purpose

n8n is an **optional automation plane** for non-authoritative notifications and ops routing. bizOS
core APIs, database, and document lifecycle remain the single source of truth. n8n failure must
never block releases, tenant operations, or customization-request creation.

## Local n8n health assessment (2026-07-28)

Assessment performed on the Ubuntu host where bizOS development runs.

| Attribute              | Finding                                                                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Installed**          | Yes — Docker container `qh-n8n`                                                                                                     |
| **Version**            | `n8nio/n8n:1.70.3` (`N8N_VERSION=1.70.3`, stable)                                                                                   |
| **Service state**      | Running, healthy (9+ days uptime)                                                                                                   |
| **Listen address**     | `127.0.0.1:5678` only (not exposed on all interfaces)                                                                               |
| **Health endpoints**   | `GET /healthz` → `{"status":"ok"}`; `GET /healthz/readiness` → `{"status":"ok"}`                                                    |
| **Compose stack**      | `/home/wasim/Projects/qloudihub/ops/stack/docker-compose.yml` (profile `core`)                                                      |
| **Persistent storage** | Docker volume `qloudihub_n8n_data` → `/var/lib/docker/volumes/qloudihub_n8n_data/_data` (mounted at `/home/node/.n8n` in container) |
| **Database**           | PostgreSQL (`postgres` service in same stack) — not SQLite                                                                          |
| **Auth mode**          | Basic auth active (`N8N_BASIC_AUTH_ACTIVE=true`); UI requires credentials                                                           |
| **HTTPS / proxy**      | `N8N_PROTOCOL=http`; localhost-only bind; no TLS termination at n8n (acceptable for local ops plane)                                |
| **Restart policy**     | `unless-stopped`                                                                                                                    |
| **Resource limits**    | Memory cap 1 GiB; observed ~130 MiB (~13%)                                                                                          |
| **Backup path**        | Included in qloudihub restic backups (`/backups/qloudihub/restic-repo`) via Docker volume archives                                  |
| **systemd unit**       | No `n8n.service` — managed by Docker Compose                                                                                        |
| **Host config dirs**   | No `/etc/n8n` or `~/.n8n` on host (data in Docker volume)                                                                           |

**Security posture:** Healthy for a **local, localhost-bound** ops instance. Not suitable as a
production-facing endpoint without reverse-proxy TLS, network isolation review, and bizOS-specific
workflow activation. Existing qloudihub workflows (WF-001, WF-003, WF-011, WF-012) are unrelated to
bizOS and remain under qloudihub governance.

## Permitted workloads

n8n may automate **non-authoritative, side-effect-safe** tasks:

| Workload                            | Direction                              | Notes                                                          |
| ----------------------------------- | -------------------------------------- | -------------------------------------------------------------- |
| Customization-request notifications | bizOS → n8n webhook                    | Implemented — dedicated webhook plus ops-event fallback        |
| Onboarding applied                  | bizOS → n8n webhook                    | Implemented — fire-and-forget after assignment persist         |
| Failed-email alerts                 | bizOS → n8n webhook                    | Implemented — quotation, invoice, and statement send failures  |
| System Admin ops alerts             | bizOS → n8n webhook                    | Implemented — assignment, default ERP, template publish/retire |
| Health routing                      | n8n cron → HTTP checks                 | Implemented — read-only; alerts only when unhealthy            |
| CI / deploy failure routing         | GitHub/local → n8n webhook or n8n poll | Implemented — webhook plus GitHub Actions poll                 |
| Non-critical support automations    | n8n → ticket/draft                     | Not implemented; human-in-the-loop still required              |

## Prohibited responsibilities

n8n must **never** be the system of record or decision authority for:

- Authentication or session issuance
- Tenant or business authorization / permission checks
- Document or invoice numbering
- Money, tax, or pricing calculations
- Document lifecycle truth (status transitions, approvals, cancellations)
- Readiness gates or go-live decisions
- Invoice issuance or payment allocation
- Database migrations or schema changes
- Immutable audit evidence (append-only logs stay in bizOS/DB)
- Core rollback or disaster-recovery orchestration

If an automation needs to change bizOS state, it must call an **authenticated, scoped bizOS API**
with idempotency — never write directly to the database.

## Integration requirements

All bizOS ↔ n8n integrations must satisfy:

1. **Authenticated / scoped APIs** — n8n calls bizOS with service credentials limited to the minimum
   API surface; bizOS never trusts n8n as an auth provider.
2. **Idempotency keys** — Outbound webhooks include `X-Idempotency-Key` (request public id). Inbound
   API calls from n8n must send idempotency keys for mutating operations.
3. **Signature validation** — When `N8N_WEBHOOK_SECRET` is set, bizOS signs payloads (`X-Signature`:
   HMAC-SHA256 hex). n8n workflows must verify before acting.
4. **Execution references in bizOS** — Future: store n8n execution id / workflow run ref on linked
   records for traceability (not required for Phase 12 stub).
5. **Tenant isolation** — Payloads include `tenantId` and `businessId`; n8n routes must not fan out
   across tenants without explicit ops scope.
6. **Least privilege** — n8n credentials per environment; no admin DB credentials in workflows.
7. **No secrets in exports** — Workflow JSON in repo is sanitized; secrets live in n8n credentials
   or host env only.
8. **Prod / dev separation** — Separate webhook URLs and secrets per environment; never point dev
   bizOS at prod n8n.
9. **Retry limits** — bizOS notifier: single attempt, log and continue. n8n: configure workflow
   error workflows with bounded retries.
10. **Dead-letter review** — Failed n8n executions reviewed via n8n UI or ops digest; not silently
    dropped.
11. **No infinite loops** — Webhooks must not call back into bizOS endpoints that re-trigger the
    same webhook without deduplication.
12. **Document active workflows** — This policy plus sanitized exports under
    `docs/operations/n8n-workflows/`.
13. **Export sanitized definitions** — Templates committed with `"active": false`; activate only
    after review.
14. **Test before activation** — Manual POST with test payload and signature verification before
    enabling workflow.
15. **Kill switch** — Unset `N8N_CUSTOMIZATION_WEBHOOK_URL` / `N8N_OPS_WEBHOOK_URL` /
    `N8N_CI_WEBHOOK_URL` (bizOS) or deactivate the workflow (n8n); both take effect immediately
    without redeploy.

## Current activation status

| Integration                  | bizOS code                                | Env vars                                                    | n8n workflow                                                      | Status                                                                                    |
| ---------------------------- | ----------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Customization-request notify | `apps/api/src/common/n8n-ops-notifier.ts` | `N8N_CUSTOMIZATION_WEBHOOK_URL` or `N8N_OPS_WEBHOOK_URL`    | `docs/operations/n8n-workflows/customization-request-notify.json` | Implemented. Local compose n8n activates with `pnpm ops:n8n:activate`.                    |
| Product ops events           | `apps/api/src/common/n8n-ops-notifier.ts` | `N8N_OPS_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET` (optional HMAC) | `docs/operations/n8n-workflows/ops-event-notify.json`             | Implemented. Covers failed email, onboarding applied, and System Admin writes.            |
| CI / deploy failure notify   | `scripts/ops/n8n-notify.mjs`              | `N8N_CI_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET` (optional)       | `docs/operations/n8n-workflows/ci-failure-notify.json`            | Implemented. GitHub jobs no-op when the secret is unset; local n8n poll covers localhost. |
| GitHub Actions poll          | — (n8n cron)                              | Optional `GITHUB_TOKEN` / `N8N_GITHUB_TOKEN`                | `docs/operations/n8n-workflows/github-actions-poll.json`          | Implemented. Public repo polling works without a token.                                   |
| Production health monitor    | — (n8n cron)                              | Optional URL overrides                                      | `docs/operations/n8n-workflows/health-monitor.json`               | Implemented. Read-only HTTP checks; Mailpit/alert webhook only on degradation.            |

**Setup runbook:** [n8n-setup-runbook.md](./n8n-setup-runbook.md)

**Local n8n in this repository:** `docker compose --profile ops up -d n8n` (container `bizos-n8n`,
loopback `127.0.0.1:5678`). Ubuntu `qh-n8n` remains a supported import target.

**Import / activate:**

```bash
pnpm ops:n8n:up
pnpm ops:n8n:import -- --activate
pnpm ops:n8n:verify
```

Git templates always ship `"active": false`. Activation is a runtime operation against a running
n8n, proven by `pnpm ops:n8n:verify` (signed webhook POST + Mailpit receipt). This repository cannot
flip Ubuntu `qh-n8n` from a cloud agent; import the same templates there with
`N8N_CONTAINER=qh-n8n pnpm ops:n8n:import -- --activate`.

When bizOS env vars are unset, notifiers return immediately — **zero runtime dependency**.

## Phase 11 payload contract

```json
{
  "id": "<customization-request-public-id>",
  "tenantId": "<tenant-public-id>",
  "businessId": "<business-public-id>",
  "urgency": "LOW|MEDIUM|HIGH",
  "status": "OPEN",
  "currentConfigurationTemplateVersionId": "<version-public-id>|null",
  "createdAt": "<ISO-8601>"
}
```

Headers:

| Header              | Required               | Description                 |
| ------------------- | ---------------------- | --------------------------- |
| `Content-Type`      | Yes                    | `application/json`          |
| `X-Idempotency-Key` | Yes                    | Same as `id`                |
| `X-Signature`       | When secret configured | HMAC-SHA256 hex of raw body |

## Ops-event payload contract

```json
{
  "event": "document.delivery.failed",
  "idempotencyKey": "<delivery-or-assignment-public-id>",
  "occurredAt": "<ISO-8601>",
  "tenantId": "<tenant-public-id>",
  "businessId": "<business-public-id>",
  "severity": "low|medium|high|critical",
  "title": "[bizOS] …",
  "message": "human-readable summary",
  "data": {}
}
```

`event` values: `customization.request.created`, `document.delivery.failed`, `onboarding.applied`,
`system_admin.assignment.changed`, `system_admin.default_erp.changed`,
`system_admin.template.status_changed`. Recipient addresses are omitted from failed-email payloads.

## Zero-cost confirmation

- No new npm dependencies.
- No paid n8n Cloud or external SaaS required.
- Local n8n is the compose `ops` profile; Ubuntu `qh-n8n` remains the host ops plane.
- bizOS releases and product writes succeed with **no n8n env vars** configured.
- n8n webhook failures are logged and swallowed; they do not propagate to API callers.

## Related artifacts

- Shared notifier: `apps/api/src/common/n8n-ops-notifier.ts`
- Phase 11 compatibility export: `apps/api/src/customization/n8n-notifier.ts`
- CI/deploy notifier: `scripts/ops/n8n-notify.mjs`
- Import / activate: `scripts/ops/import-n8n-workflows.sh`, `scripts/ops/n8n-activate.mjs`
- Verify: `scripts/ops/n8n-verify.mjs`
- Setup runbook: `docs/operations/n8n-setup-runbook.md`
- Workflow templates: `docs/operations/n8n-workflows/`
- Compose service: `compose.yaml` profile `ops` (container `bizos-n8n`)
- qloudihub stack reference: `/home/wasim/Projects/qloudihub/ops/stack/docker-compose.yml`
