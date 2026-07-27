# Cloudflare R2 object storage

Status: Provisioned (inactive application seam for private beta)

Last reviewed: 2026-07-27

## Bucket

| Field         | Value                                                                    |
| ------------- | ------------------------------------------------------------------------ |
| Name          | `bizos-production`                                                       |
| Storage class | Standard                                                                 |
| Location hint | EEUR                                                                     |
| Jurisdiction  | default                                                                  |
| Public access | Disabled / private by default                                            |
| Intended use  | Quotation PDF bytes, immutable sent artifacts, logos, future attachments |

## Access model

- S3-compatible API via `@bizo/storage` (`createR2Client`)
- Credentials: `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, account id from `CLOUDFLARE_ACCOUNT_ID` /
  `R2_ACCOUNT_ID`
- Endpoint: `R2_ENDPOINT` or `https://{accountId}.r2.cloudflarestorage.com`
- Bucket name: `R2_BUCKET=bizos-production`
- No public bucket ACL; serve through authorized app endpoints or short-lived signed URLs only

## Application activation

Deferred for private beta. The quotation MVP already generates PDFs in-memory from immutable
PostgreSQL snapshots, streams downloads, and emails attachments without object storage.

The storage package exposes `createR2Client`, `objectKey`, and `quotationPdfObjectKey`. Full PDF
object persistence still needs put/get/signed-URL helpers, Attachment metadata in PostgreSQL, and
download authorization. Target key shape:

`tenants/{tenantId}/businesses/{businessId}/quotations/{quotationId}/versions/{versionId}/quotation.pdf`

Activating that path is a files-module change, not a configuration flip. Per release priority, R2 is
provisioned and validated independently so production cutover is not blocked.

## Free-tier envelope (Standard)

Approximate Cloudflare R2 free monthly allowance:

- 10 GB-month Standard storage
- 1 million Class A operations (writes/lists)
- 10 million Class B operations (reads)
- Free internet egress

Overage risk points for bizOS:

- Many unique PDF stores/resends increasing Class A writes
- Frequent PDF downloads increasing Class B reads
- Retaining every historical version forever without lifecycle rules (storage GB-month)

Infrequent Access is intentionally unused because the free allowance applies to Standard storage.

## Validation

Run GitHub Actions workflow `Infrastructure validation` (workflow_dispatch). The R2 job:

1. Writes a uniquely named probe object under `infrastructure/probes/`
2. Reads and checksum-verifies it
3. Deletes it
4. Logs pass/fail without secret or body leakage

## Monitoring

- Track R2 usage in the Cloudflare dashboard (storage and Class A/B)
- Alert when approaching free-tier Class A/B or storage limits before private-beta traffic grows
