# Webhook security gate (Sprint 6 · TASK-25)

Automated penetration-style proofs for the outbound webhook subsystem. The executable gate lives in
`apps/api/src/webhooks/webhook-security.gate.spec.ts` and must stay green on every CI run.

## SEC checklist

| ID    | Property                                                                    | Proof                                  |
| ----- | --------------------------------------------------------------------------- | -------------------------------------- |
| SEC-1 | Registration rejects http, localhost, private IPs, credentials, `.internal` | Gate + `webhook-url.spec.ts`           |
| SEC-2 | Dispatch-time DNS rebinding fails closed                                    | Gate + `webhook-url.spec.ts`           |
| SEC-3 | HMAC forgery / replay binding (`timestamp.body`)                            | Gate + `webhook-signature.spec.ts`     |
| SEC-4 | Receiver freshness helper (`isWebhookTimestampFresh`)                       | Gate + `webhook-signature.spec.ts`     |
| SEC-5 | Secrets encrypted at rest; wrong key fails                                  | Gate + `webhook-secret-cipher.spec.ts` |
| SEC-6 | Link-local / metadata IP ranges classified private                          | Gate                                   |
| SEC-7 | Malformed signature headers never throw                                     | Gate                                   |

Tenant isolation, secret-once-at-issue, and SSRF on update remain covered by
`webhooks.service.spec.ts`. Durable retry / dead-letter behaviour is covered by
`webhook-dispatch.service.spec.ts`.

## Receiver contract (integrators)

1. Read `X-Bizo-Timestamp` and reject if `isWebhookTimestampFresh` (or equivalent ±300s skew) fails.
2. Recompute `HMAC-SHA256(secret, \`${timestamp}.${rawBody}\`)`and compare with`X-Bizo-Signature`
   using a constant-time compare.
3. Use the plaintext `whsec_…` value returned **once** at endpoint create / rotate — it is never
   re-listed by the management API.

## Run

```bash
pnpm --filter @bizo/api exec vitest run src/webhooks/webhook-security.gate.spec.ts
pnpm --filter @bizo/api exec vitest run src/webhooks
```
