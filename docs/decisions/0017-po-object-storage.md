# ADR-0017: Private object storage for PO and approval files

Status: Accepted

Date: 2026-07-27

Deciders: Product and engineering

## Context

PO and approval evidence files need private storage. Cloudflare R2 is already provisioned on the
free tier, but the application put/get seam was inactive. Render’s filesystem is ephemeral, so local
disk cannot be the production store.

## Decision drivers

- £0 cost (existing R2 free tier)
- Private objects; no permanent public URLs
- Testable without R2 credentials in CI
- Licence-safe, maintained dependencies

## Open-source acceleration review (time-boxed)

| Candidate                                                       | Fit           | Licence    | Decision                                          |
| --------------------------------------------------------------- | ------------- | ---------- | ------------------------------------------------- |
| Existing `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` | R2 S3 API     | Apache-2.0 | **Adopt (already present)**                       |
| `file-type` npm                                                 | MIME sniffing | MIT        | **Defer** — allowlist + magic-byte checks in-repo |
| New upload framework                                            | Overkill      | —          | **Reject**                                        |
| Postgres `bytea` for files                                      | Simple        | —          | **Reject** for production (DB free-tier pressure) |

No new npm dependency is introduced for this slice.

## Decision

Implement `@bizo/storage` `ObjectStore`:

1. **`R2ObjectStore`** when `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and
   `R2_BUCKET` are set — production path.
2. **`LocalObjectStore`** when `OBJECT_STORE=local` or R2 is unset — CI/dev only under
   `OBJECT_STORE_ROOT` (default `.data/object-store`).

API downloads stream bytes after authz. Optional short-lived signed GET URLs may be added later; MVP
uses application-mediated download only.

## Consequences

Production deploys must keep R2 secrets configured or uploads fail with a clear error. CI uses local
store. Free-tier R2 class A/B operation limits are documented in operations docs.

## Validation and review trigger

Put/get/delete integrity, path traversal rejection, cross-tenant key denial, 10 MiB limit,
content-type allowlist. Revisit if free-tier R2 limits block private beta.
