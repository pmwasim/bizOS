# ERPNext/Frappe local foundation runbook

Status: Local runtime and authenticated connection proof verified; module permission contract
pending

## Purpose

This is an isolated local development or evaluation environment for the ERPNext/Frappe foundation.
It is not a production deployment and does not share PostgreSQL, Redis, credentials, or volumes with
the existing bizOS compose stack.

## Pinned upstream

Use the official `frappe_docker` release `v3.2.1`, commit
`d4a310089f5d6fc38ed1317b898d75b9c74901db`. Do not use an unpinned `main` checkout for the
foundation proof.

The official disposable evaluation setup is appropriate only for proving the supported Frappe API
boundary. It is not appropriate for production, custom application development, real customer data,
or an internet-exposed environment.

## Host prerequisites

- Docker Engine running, with Docker Compose v2.
- At least 8 GB of Docker memory available for the isolated ERPNext services.
- An ARM-capable image path or Docker Desktop configuration suitable for Apple Silicon.
- A local host-only published port that does not conflict with bizOS services.

## Provisioning sequence

1. Create a separate, disposable checkout outside this repository and verify the pinned upstream
   commit.
2. Follow the official `frappe_docker` evaluation or development path for the pinned release.
3. Bind any exposed HTTP port to `127.0.0.1`; do not expose the evaluation site on all interfaces.
4. Replace all evaluation credentials before creating a non-disposable site.
5. Create a dedicated, least-privilege Frappe integration user for bizOS. Never use the ERPNext
   Administrator credentials in `FRAPPE_API_KEY` or `FRAPPE_API_SECRET`.
6. Configure `FRAPPE_BASE_URL`, `FRAPPE_API_KEY`, and `FRAPPE_API_SECRET` together in the local
   bizOS environment.
7. Run the API ERPNext-client test and perform an authenticated `get_logged_user` check against the
   local site.
8. Capture the Frappe/ERPNext versions, site name, integration-user permissions, and verification
   result in the foundation evidence record.

## Safety gates

- No customer or production data enters the evaluation environment.
- No direct access from bizOS to the ERPNext database is permitted.
- No Frappe user token is committed, logged, or placed in browser code.
- A successful HTTP response is not enough: verify that the integration user has only the required
  role permissions and that requests appear in Frappe audit history.
- Stop after the connection proof. Customer, quotation, and invoice synchronization requires a
  separate, tested module contract.

## Local verification record

On 2026-07-28, the pinned official disposable evaluation environment was brought up on Apple Silicon
with Docker Compose. The ERPNext image was `frappe/erpnext:v16.26.2`; the MariaDB service reported
healthy; the one-time `create-site` service exited with status `0`; and the local-only frontend
responded to `GET /api/method/ping` with `{\"message\":\"pong\"}`.

An unauthenticated request to the protected `frappe.auth.get_logged_user` endpoint was rejected with
HTTP `403`, as expected. A local-only, roleless disposable integration identity was then issued a
token and authenticated successfully to that endpoint, returning its own identity with HTTP `200`.
The token was immediately rotated after the proof and was never committed, logged, or configured in
bizOS.

This proves the isolated ERPNext runtime and the supported authenticated API boundary. It does not
authorize a business module: the exact Frappe user, roles, DocType permissions, audit events, and
business-isolation checks must be defined and tested by the first module before a durable token is
created or configured in a bizOS environment.
