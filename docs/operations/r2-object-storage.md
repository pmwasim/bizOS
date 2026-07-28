# Cloudflare R2 object storage

Status: Provisioned; **PO/approval uploads activate the application seam** (ADR-0017)

Last reviewed: 2026-07-27

## Bucket

| Field         | Value                                                            |
| ------------- | ---------------------------------------------------------------- |
| Name          | `bizos-production`                                               |
| Storage class | Standard                                                         |
| Location hint | EEUR                                                             |
| Jurisdiction  | default                                                          |
| Public access | Disabled / private by default                                    |
| Intended use  | PO files, approval evidence; later quotation PDF bytes and logos |

## Access model

- S3-compatible API via `@bizo/storage` (`createR2Client`, `R2ObjectStore`, `LocalObjectStore`)
- Credentials: `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, account id from `CLOUDFLARE_ACCOUNT_ID` /
  `R2_ACCOUNT_ID`
- Endpoint: `R2_ENDPOINT` or `https://{accountId}.r2.cloudflarestorage.com`
- Bucket name: `R2_BUCKET=bizos-production`
- No public bucket ACL; bytes are served only through authorised API downloads

## Application activation

Purchase-order and approval-evidence uploads use `createObjectStoreFromEnv`:

- Production: R2 when `R2_*` secrets are set
- CI/dev: `OBJECT_STORE=local` with `OBJECT_STORE_ROOT` (Render filesystem is ephemeral — do not
  rely on local store in production)

Metadata lives in `stored_objects`. Object keys:

`tenants/{tenantPublicId}/businesses/{businessPublicId}/purchase-orders/{poId}/{fileId}/{safeFilename}`  
`tenants/{tenantPublicId}/businesses/{businessPublicId}/approval-evidence/{poId}/{fileId}/{safeFilename}`

Quotation PDF object persistence remains deferred (in-memory PDF from snapshots).

## Free-tier limits

Document Cloudflare R2 free-tier Class A/B operation and storage ceilings in the monthly ops review.
Fail uploads clearly rather than silently falling back to ephemeral disk in production.
