# ADR-0009: Use Auth.js at the browser session boundary

Status: Accepted  
Date: 2026-07-26

## Context

The web product needs provider-based authentication, secure browser sessions, future public API
credentials, and a clean separation between identity and business authorization.

## Options considered

- Custom authentication: maximum control with unacceptable credential and protocol risk.
- Managed identity only: strong service but early vendor and cost commitment.
- Auth.js with vetted providers: portable application integration and standard session controls.

## Decision

Use Auth.js in the Next.js server boundary for human browser authentication. NestJS validates a
server-issued internal identity assertion or shared session adapter; it never trusts client claims.
Casbin remains responsible for business authorization. Public API and mobile credentials are
separate bounded mechanisms.

## Consequences

Provider configuration, session rotation, CSRF, cookie, and adapter behavior require real
integration tests. Native mobile support does not reuse browser cookies blindly.

## Validation and review trigger

Re-evaluate when enterprise federation, identity assurance, regional requirements, or native client
flows exceed Auth.js/provider capabilities.
