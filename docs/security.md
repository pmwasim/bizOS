# Security

Status: Accepted security baseline

## Security objectives

Protect tenant isolation, business records, identities, credentials, document bytes, workflows, and
audit evidence. Availability matters, but a fast cross-tenant response is a security failure.

## Trust boundaries

- Browser and mobile clients are untrusted.
- All request, webhook, queue, plugin, AI, and stored user content is untrusted input.
- Next.js client/server module separation is a security boundary.
- CDN, identity, email, payment, tax, and storage providers are external dependencies.
- Redis, search, analytics, and AI indexes are derived stores, not authorization sources.

## Baseline controls

### Identity and session

- Auth.js with vetted providers; no custom password cryptography.
- HttpOnly, SameSite session cookies; `Secure` only on HTTPS production environments.
- Session rotation at sign-in and privilege change, bounded lifetime, revocation, and MFA for
  privileged roles before launch.
- CSRF tokens and strict origin checks for cookie-authenticated mutations.

### Authorization and isolation

- Deny-by-default Casbin policy with tenant/business domain inputs.
- Server-side object authorization on every action; UI gating is convenience only.
- Scoped repositories and real PostgreSQL negative tests.
- Agents, integrations, support access, and jobs use separate least-privilege principals.

### Application

- Runtime validation and conservative body/file limits.
- Helmet/security headers, no framework fingerprinting, and production-safe errors.
- CSP introduced before user-generated rich content or third-party scripts; no unreviewed
  `unsafe-inline` or `unsafe-eval`.
- No raw HTML injection, string-to-code execution, shell interpolation, arbitrary redirects, or
  unrestricted outbound URL fetching.
- CORS off by default; credentials never paired with broad origins.
- Rate limits at edge and application for authentication and expensive commands.

### Data and files

- TLS in transit and managed encryption at rest.
- Secrets from a secret manager, never source, client bundles, logs, or build arguments.
- R2 buckets private; short-lived signed operations; random keys; type, size, checksum, malware, and
  active-content controls. Uploads never enter `public/`.
- Backups encrypted, access-controlled, retained, and restored in exercises.
- Data classification, retention, export, and deletion cover derived stores and backups.

### Supply chain

- Exact dependencies, frozen pnpm lockfile, release-age gate, Dependabot, dependency review, CodeQL,
  secret scanning, SBOM, image scan, artifact provenance, and pinned Actions.
- Protected default branch, required review/checks, CODEOWNERS, signed release tags, and least
  GitHub workflow permissions.

## AI and plugin controls

No extension gets database credentials or platform-wide authority. Inputs and outputs are
schema-validated. Retrieval is permission-filtered. Tool calls are allowlisted, rate- and
time-bounded, auditable, and idempotent. Prompt content is data, not instruction. Material actions
show a preview and require confirmation bound to the action hash.

## Vulnerability handling

Report privately using GitHub private vulnerability reporting or the process in `SECURITY.md`. Do
not disclose customer data in reports. Triage assigns severity, owner, containment, patch,
notification decision, and retrospective. Security fixes do not weaken tests or controls to restore
a green build.

## Launch gates

- Independent tenant-isolation and authorization review.
- Threat model and abuse cases for each public workflow.
- External penetration test of the production-shaped deployment.
- Secret rotation, backup restore, incident response, and dependency compromise exercises.
- Runtime verification of headers, cookies, TLS, CORS, rate limits, errors, and file delivery.
