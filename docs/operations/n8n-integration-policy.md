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

| Workload                            | Direction                              | Notes                                                    |
| ----------------------------------- | -------------------------------------- | -------------------------------------------------------- |
| Customization-request notifications | bizOS → n8n webhook                    | **Implemented (Phase 11 stub)** — fires after DB persist |
| Onboarding reminders                | bizOS → n8n or n8n cron → notification | Future; read-only API fetch only                         |
| Failed-email alerts                 | bizOS/mail provider → n8n              | Route to ops channel; no retry of send authority         |
| System Admin ops alerts             | bizOS → n8n                            | Assignment changes, template publishes, audit spikes     |
| Health routing                      | n8n cron → HTTP checks                 | Internal monitoring only; no state mutation              |
| Non-critical support automations    | n8n → ticket/draft                     | Human-in-the-loop; no auto-close of bizOS records        |

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
15. **Kill switch** — Unset `N8N_CUSTOMIZATION_WEBHOOK_URL` (bizOS) or deactivate workflow (n8n);
    both take effect immediately without redeploy.

## Current activation status

| Integration                  | bizOS code                                   | Env vars                                                         | n8n workflow                                                      | Status                                                 |
| ---------------------------- | -------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------ |
| Customization-request notify | `apps/api/src/customization/n8n-notifier.ts` | `N8N_CUSTOMIZATION_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET` (optional) | `docs/operations/n8n-workflows/customization-request-notify.json` | **Deferred** — stub only; webhook URL unset by default |

**Production n8n workflow:** Not activated. Template exported for import; `"active": false`.
Activate only after:

1. Import workflow into n8n and configure `BIZOS_WEBHOOK_SECRET` credential (must match bizOS
   `N8N_WEBHOOK_SECRET`).
2. Set `N8N_CUSTOMIZATION_WEBHOOK_URL` in bizOS API environment to the n8n webhook URL.
3. Send test POST; confirm signature gate and notification routing.
4. Explicit ops approval to set `"active": true`.

When env vars are unset, `notifyCustomizationRequestCreated` returns immediately — **zero runtime
dependency**.

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

## Zero-cost confirmation

- No new npm dependencies.
- No paid n8n Cloud or external SaaS required.
- Uses existing self-hosted n8n on localhost (qloudihub stack).
- bizOS releases and customization-request creation succeed with **no n8n env vars** configured.
- n8n webhook failures are logged and swallowed; they do not propagate to API callers.

## Related artifacts

- Phase 11 notifier: `apps/api/src/customization/n8n-notifier.ts`
- Workflow template: `docs/operations/n8n-workflows/customization-request-notify.json`
- qloudihub stack reference: `/home/wasim/Projects/qloudihub/ops/stack/docker-compose.yml`
