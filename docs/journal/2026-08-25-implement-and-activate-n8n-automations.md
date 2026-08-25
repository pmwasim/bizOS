# Implement and activate n8n automations

Date: 2026-08-25

Agent: cursor-n8n-561e

Scope: apps/api/src/common, apps/api/src/customization, apps/api/src/documents, apps/api/src/onboarding, apps/api/src/statements, apps/api/src/system-admin, docs/operations, scripts/ops, compose.yaml, .github/workflows

Status: Done

Related: [n8n-integration-policy.md](../operations/n8n-integration-policy.md); previous deferred n8n templates

## Context

n8n was an optional ops plane with four inactive, log-only workflow templates and a customization-request stub. The request was to implement and activate automations for **production of bizOS** (CI/health) and **bizOS itself** (product events), without paid n8n Cloud.

This cloud agent cannot reach Ubuntu `qh-n8n`. In-repo compose `bizos-n8n` is the activation target that can be proven here; `qh-n8n` remains a supported import target.

## What changed

- Shared signed notifier `apps/api/src/common/n8n-ops-notifier.ts` for customization, failed quotation/invoice/statement email, onboarding applied, and System Admin assignment/default-ERP/template status events. Failures still cannot fail the product write.
- Workflow catalog now delivers via Mailpit (`BIZOS_OPS_MAILPIT_URL`) or `BIZOS_OPS_ALERT_WEBHOOK_URL` instead of log-only stubs. Added `ops-event-notify.json`. Health checks continue on HTTP errors so degraded endpoints still alert.
- Compose profile `ops` runs `n8nio/n8n:1.70.3` as `bizos-n8n` on `127.0.0.1:5678`. `pnpm ops:n8n:import -- --activate` and `pnpm ops:n8n:verify` import, activate, and prove signed webhooks plus Mailpit receipt.
- GitHub `notify-n8n` jobs on production-health and production-release-gate failure (no-op when secrets are unset). GitHub Actions poll no longer requires a token for the public repo.

## Decisions and trade-offs

- No new ADR: n8n stays non-authoritative; compose n8n is the in-repo instance of the existing policy.
- Customer-facing onboarding *reminders* were not implemented: that needs a read-only authenticated bizOS API. The implemented event is `onboarding.applied` (ops visibility after persist).
- Git templates remain `"active": false`. Activation is runtime (`n8n-activate.mjs`), proven by `n8n-verify.mjs`.
- Ubuntu `qh-n8n` is documented, not flipped from this VM.

## Verification

```text
node --test scripts/ops/n8n-workflows.spec.mjs scripts/check-local-services.spec.mjs
# passed: 8 tests (later revision; was 7 at journal open)

pnpm --filter @bizo/api typecheck
# passed

pnpm --filter @bizo/api^... build && pnpm --filter @bizo/api exec vitest run \
  src/common/n8n-ops-notifier.spec.ts src/customization/n8n-notifier.spec.ts \
  src/customization/customization.service.spec.ts src/onboarding/onboarding.service.spec.ts \
  src/system-admin/system-admin.service.spec.ts src/documents/quotations.service.spec.ts \
  src/documents/invoices.service.spec.ts src/statements/statement-delivery.service.spec.ts
# passed: 8 files, 78 tests

pnpm security:local-services
# passed: 8 tests + compose loopback check

pnpm graph && pnpm agent:verify
# passed: graph current, journal valid, claim still active until release

pnpm lint
# not run

pnpm check
# not run (full gate)

# Live compose n8n (bizos-n8n, n8nio/n8n:1.70.3)
pnpm ops:n8n:up && node scripts/ops/n8n-activate.mjs --container bizos-n8n --activate
# passed: five bizOS workflows imported, activated, n8n restarted, /healthz ok

pnpm ops:n8n:verify
# passed (after Code-node title builders; earlier runs failed):
#   customization/ops/ci webhooks 200
#   Mailpit subjects:
#     [bizOS] HIGH customization request
#     [bizOS] verify delivery failed <timestamp>
#     [bizOS] CI failure: Verify

# Cron at 08:00 UTC (same container, observed in n8nEventLog + Mailpit):
#   bizOS Health Monitor execution 24 success
#     Mailpit: [bizOS] Health degraded (production web 403, API ok)
#   bizOS GitHub Actions Poll execution 23 success
#     Mailpit: [bizOS] GitHub failure: CI
```

Live failures that were fixed in this session (not left in the activated templates):

- Code `require('crypto')` without `NODE_FUNCTION_ALLOW_BUILTIN`
- Code `fetch is not defined` (n8n 1.70 sandbox)
- `new URL` is not defined in that sandbox
- Merge node multiplex without match fields
- Set v3 `values.string` did not pass `title` into Deliver Alert

Ubuntu `qh-n8n` and GitHub/`N8N_*` production secrets: **not run** from this VM.

## Follow-ups

- Import/activate the same templates on Ubuntu `qh-n8n` (`N8N_CONTAINER=qh-n8n pnpm ops:n8n:import -- --activate`) and set production API `N8N_OPS_WEBHOOK_URL` / `N8N_CUSTOMIZATION_WEBHOOK_URL`.
- Optional GitHub secrets `N8N_CI_WEBHOOK_URL` and `N8N_WEBHOOK_SECRET` if a reachable webhook is preferred over the 15-minute poll.
- Customer onboarding reminders still need a scoped read API; do not have n8n query the database.

## Handoff notes

Compose `bizos-n8n` is running with all five workflows active. Re-import updates by n8n id (`n8n-activate.mjs`). qh-n8n needs `NODE_FUNCTION_ALLOW_BUILTIN=crypto,http,https` plus `N8N_CONTAINER=qh-n8n pnpm ops:n8n:import -- --activate`. Production API still no-ops until `N8N_OPS_WEBHOOK_URL` / `N8N_CUSTOMIZATION_WEBHOOK_URL` are set. Claim `clm_665acf0a` released at session end.
