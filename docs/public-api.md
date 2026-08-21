# Using the public API

Status: Accepted

The public REST API is described by an OpenAPI 3.1 document generated from the same Zod contracts
the server enforces at runtime, so the reference never drifts from the implementation. See
[api-guidelines.md](api-guidelines.md) for the cross-cutting style, versioning, and error rules this
page assumes.

## Where the spec and reference UI live

The API runs under the global prefix `api` with the major version in the path (`/api/v1`).

| Resource                           | Route                           |
| ---------------------------------- | ------------------------------- |
| Raw OpenAPI 3.1 document           | `GET /api/v1/docs/openapi.json` |
| Interactive reference (Swagger UI) | `GET /docs`                     |

The reference UI is served from the API's own origin (no CDN at request time), so it renders offline
and under the default `helmet` Content-Security-Policy.

## Authenticating with an API key

Programmatic callers present a scoped API key on every request, either way below:

```http
Authorization: Bearer <key>
```

```http
X-API-Key: <key>
```

A key is issued once through the management API (`POST /api/v1/businesses/{businessId}/api-keys`);
the plaintext `secret` is returned only in that response and can never be retrieved again. Rotating
a key (`POST .../api-keys/{keyId}/rotate`) returns a fresh secret and invalidates the old one.

Each key carries a set of `<resource>:<access>` scopes. `read` grants retrieval; `write` grants
creation and mutation. The full set is:

- `invoices:read`, `invoices:write`
- `payments:read`, `payments:write`
- `customers:read`, `customers:write`
- `products:read`, `products:write`

A request whose key is unknown, revoked, or expired is rejected with `401 Unauthorized`. A valid key
that is missing a scope the endpoint requires is rejected with `403 Forbidden`. These scopes are the
coarse-grained capability model for programmatic callers and are independent of the fine-grained
per-role permissions enforced for humans in the app.

> The API-key and webhook **management** endpoints are operated by authenticated humans through the
> application and are protected by the browser session, not by an API key.

## Rate-limit headers

Requests authenticated with an API key are rate limited per key with a fixed window. Every response
carries the current budget:

| Header                  | Meaning                                                 |
| ----------------------- | ------------------------------------------------------- |
| `X-RateLimit-Limit`     | Maximum requests allowed in the current window.         |
| `X-RateLimit-Remaining` | Requests still available in the current window.         |
| `Retry-After`           | Seconds to wait before retrying — sent only on a `429`. |

When the budget is exhausted the API responds `429 Too Many Requests` with `Retry-After`. The
default budget is **120 requests per 60-second window** per key (configurable via
`API_KEY_RATE_LIMIT` and `API_KEY_RATE_LIMIT_WINDOW_MS`).

## Errors

Errors use RFC 9457 `application/problem+json`:

```json
{
  "type": "https://docs.bizo.example/problems/forbidden",
  "title": "You cannot do that",
  "status": 403,
  "detail": "This API key is missing a required scope.",
  "code": "FORBIDDEN",
  "requestId": "01...",
  "errors": []
}
```

`code` is stable and machine-readable; `detail` is safe to surface and never contains secrets, SQL,
stack traces, or another tenant's identifiers. Correlate with the `requestId` (echoed as the
`x-request-id` response header).

## Verifying a webhook signature

Each webhook endpoint subscribes to a set of event types and receives a signed HTTP `POST` for every
matching delivery. The request body is a JSON envelope:

```json
{
  "id": "<delivery-id>",
  "event": "invoice.paid",
  "createdAt": "2026-08-18T09:30:00.000Z",
  "data": {}
}
```

Every delivery carries these headers:

| Header             | Meaning                                                            |
| ------------------ | ------------------------------------------------------------------ |
| `X-Bizo-Signature` | `sha256=<hex>` — HMAC-SHA256 over `` `${timestamp}.${rawBody}` ``. |
| `X-Bizo-Timestamp` | Unix-seconds timestamp the signature is bound to.                  |
| `X-Bizo-Event`     | The event type.                                                    |
| `X-Bizo-Delivery`  | Unique delivery id (also the envelope `id`); deduplicate on it.    |

To verify a delivery:

1. Read the `X-Bizo-Timestamp` header and reject the delivery if it is outside your freshness window
   (recommended ±300 seconds — `isWebhookTimestampFresh` in `@bizo/api` mirrors this). This defeats
   replay.
2. Recompute `HMAC-SHA256(secret, `` `${timestamp}.${rawBody}` ``)` over the **raw** request bytes —
   not a re-serialized body.
3. Compare your hex digest against the value in `X-Bizo-Signature` using a constant-time comparison.
4. Deduplicate on `X-Bizo-Delivery` before acting on the event.

Automated proofs for SSRF, forgery, and secret handling:
[Webhook security gate](operations/webhook-security-gate.md).

The signing secret is returned once, at endpoint creation or secret rotation
(`POST .../webhooks/{endpointId}/rotate-secret`), and is prefixed `whsec_`.

```js
import { createHmac, timingSafeEqual } from "node:crypto";

// `rawBody` is the exact bytes received, before JSON parsing.
function verify(secret, headers, rawBody) {
  const timestamp = headers["x-bizo-timestamp"];
  const expected = `sha256=${createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex")}`;
  const presented = headers["x-bizo-signature"];
  const a = Buffer.from(expected);
  const b = Buffer.from(presented);
  return a.length === b.length && timingSafeEqual(a, b);
}
```

Webhook target URLs must be HTTPS and are validated against SSRF (localhost, private, and link-local
addresses are rejected at registration and again, fail-closed, before every dispatch).
