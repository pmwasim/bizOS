# ADR-0022: Signed client-IP forwarding for throttling

Status: Accepted Date: 2026-07-28 Deciders: Platform

## Context

The web BFF forwards the end-user IP to the API as `x-bizo-client-ip`, and the API's
`ClientAwareThrottlerGuard` trusts that header as the throttle tracker identity. The API is
reachable on a public custom domain, and the header is not authenticated. A direct caller can send
repeated signup/credential-verify requests while rotating `x-bizo-client-ip`, resetting the 5/minute
signup and 10/minute verify limits each time (audit finding BIZ-003).

## Decision drivers

- Throttle identity must not be attacker-controlled.
- Zero-budget constraint: no new infrastructure (no private-origin network change yet).
- The BFF already observes the real client IP; it must be able to prove that observation to the API.
- Backward compatibility for local development and existing E2E.

## Options considered

1. **Private API origin reachable only by the web service.** Strongest network control, but requires
   hosting/network changes and cost; not available on the current free topology.
2. **HMAC-signed forwarded metadata (chosen).** The BFF signs `ip.timestamp` with a shared secret;
   the API only honours the forwarded IP when the signature is present, valid, and fresh. No new
   infrastructure; deployable in two phases.
3. **Ignore the forwarded IP entirely.** Simple, but collapses all BFF traffic onto the web
   service's address, so per-user throttles would be shared and ineffective.

## Decision

- Add optional `CLIENT_IP_SIGNATURE_SECRET` (≥32 bytes) to both web and API environments.
- When configured, the BFF sends
  `x-bizo-client-ip-signature: "<unixMs>.<hexHmacSha256(ip.unixMs)>"`.
- The API trusts the forwarded IP only when the signature verifies (constant-time) and is within a
  60-second freshness window; otherwise it falls back to the direct peer address.
- When the secret is **not** configured (local development, current E2E), the API keeps legacy trust
  so existing flows keep working. Production must set the secret; that is an ops requirement, not a
  code default.
- Use a purpose-specific secret, never `INTERNAL_AUTH_SECRET`, so rotation and scope are separate.

## Consequences

- Forged or absent signatures can no longer control the throttle tracker identity in production.
- Replay is bounded to the freshness window and bound to a specific IP and secret.
- The signing covers IP + timestamp only (not method/path/nonce); this stops header-rotation abuse
  but is not a full request-signing scheme.
- A named `perAccount` throttler (5/minute) now applies to `POST /auth/signup` and
  `POST /auth/verify`. The guard keys that throttler on the normalized account email, so brute force
  against a single account is bounded regardless of source IP; other endpoints fall through to the
  IP tracker. Global abuse controls remain follow-up work.
- Two-phase rollout: deploy API and web with the secret set; no feature flag needed because unsigned
  requests still work until the secret is present.

## Validation and review trigger

- Unit tests cover forged, absent, malformed, expired, future-dated, and wrong-IP signatures, plus
  IPv4/IPv6.
- Revisit if a private API origin becomes available, or when per-account throttling is added.
