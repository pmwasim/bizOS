# Sprint 6 TASK-25 webhook security penetration gate

Date: 2026-08-21

Agent: cursor-autonomy

Scope: apps/api, docs

Status: Ready for review

Related: Sprint 6 TASK-23 (signed webhooks),
[docs/operations/webhook-security-gate.md](../operations/webhook-security-gate.md)

## Context

Sprint 6 closes with a security gate over the webhook surface: SSRF (registration + DNS rebinding),
HMAC forgery/replay binding, encrypted secrets, and a documented receiver freshness helper.

## What changed

- `isWebhookTimestampFresh` (+ default ±300s) on the signature module for integrator-facing replay
  rejection.
- `webhook-security.gate.spec.ts` — named SEC-1…SEC-7 hermetic proofs.
- `docs/operations/webhook-security-gate.md` + cross-links from `docs/public-api.md` and
  `docs/security.md`.

## Decisions and trade-offs

- Gate is hermetic (no DB). Tenant isolation remains in `webhooks.service.spec.ts`.
- Freshness is a receiver helper/export; the outbound dispatcher already binds signatures to
  timestamps.

## Verification

```text
pnpm --filter @bizo/api exec vitest run src/webhooks/webhook-security.gate.spec.ts src/webhooks/webhook-signature.spec.ts
# 20 passed
```

## Follow-ups

- External prod-shaped pentest remains a launch gate in `docs/security.md` (out of band).
- Optional: surface `isWebhookTimestampFresh` from a small shared package if non-API receivers need
  it without importing the Nest app.

## Handoff notes

Completes Sprint 6 task list (22–25) on the product side once this merges.
