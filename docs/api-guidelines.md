# API guidelines

Status: Accepted

## Style

The public API is resource-oriented HTTP+JSON described by OpenAPI. Internal modules communicate
through typed application interfaces and domain events, not loopback HTTP. Webhooks publish facts to
external systems.

## URLs and versions

```text
https://api.example.com/v1/businesses/{business_id}/documents/{document_id}
```

- Use plural nouns and lowercase kebab-case.
- The major API version is in the path.
- Additive compatible changes do not require a new major version.
- Breaking changes require a parallel version, migration guide, and published sunset.
- Public IDs are opaque; clients must not infer chronology or counts from them.

## Requests

- JSON uses `camelCase`; timestamps use RFC 3339 UTC; dates use ISO `YYYY-MM-DD`.
- Money is `{ amountMinor: "12345", currency: "SAR", scale: 2 }`; integers are strings where
  JavaScript number safety could be exceeded.
- Runtime schemas reject unknown security-sensitive fields.
- Mutations accept `Idempotency-Key`; keys are scoped to principal, business, operation, and
  canonical request hash.
- Optimistic concurrency uses an opaque version or `If-Match`.
- File upload is a separate presigned flow with type, size, checksum, expiry, and finalize step.

## Responses

- Success returns the resource or a documented command result.
- Collections use cursor pagination with stable ordering.
- Asynchronous work returns `202 Accepted`, an operation resource, and truthful state.
- Sensitive responses use `Cache-Control: private, no-store`.
- Every response includes `x-request-id`; clients may provide a bounded valid value.

Error shape:

```json
{
  "type": "https://docs.example.com/problems/version-conflict",
  "title": "This item changed",
  "status": 409,
  "detail": "Refresh to review the latest version before deciding.",
  "code": "VERSION_CONFLICT",
  "requestId": "01...",
  "errors": []
}
```

Problem responses follow RFC 9457. `detail` is safe for the caller and never contains stack traces,
SQL, secrets, policies, or another tenant's identifiers.

## Authentication and authorization

- Browser sessions are HttpOnly, SameSite cookies managed by Auth.js.
- Cookie-authenticated mutations require CSRF protection and strict origin checks.
- Public API clients use short-lived scoped credentials; CORS is disabled unless a browser use case
  is explicitly approved.
- The API derives tenant scope from the authenticated principal, authorizes business access, then
  loads the object. A request body or path cannot grant scope.

## Webhooks

- Payloads are versioned event envelopes with event ID, time, tenant/business, and data.
- Deliveries are signed over raw bytes, replay-protected, retried with backoff, and observable.
- Consumers deduplicate by event ID.
- URLs are HTTPS and protected against SSRF through validation, DNS/IP controls, redirect limits,
  timeouts, and network egress policy.

## Contract lifecycle

OpenAPI and transport schemas live with code, while `packages/contracts` contains transport-neutral
shared schemas. CI checks examples, breaking changes, generated clients, and authorization coverage
before exposing a route publicly.
