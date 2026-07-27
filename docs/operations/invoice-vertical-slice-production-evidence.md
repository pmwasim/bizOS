# Production evidence — Invoice vertical slice

Date: 2026-07-28 (UTC)

## Deployed state

| Item                        | Value                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------ |
| Feature merge               | `bf91c76` — PR [#28](https://github.com/pmwasim/bizOS/pull/28)                                   |
| Authoritative starting main | `67023898373054b2ccb47101ebce988af677c325`                                                       |
| Production deploy workflow  | [run 30308786048](https://github.com/pmwasim/bizOS/actions/runs/30308786048) — success           |
| Migrations                  | `20260728010000_invoice_document_slice`, `20260728010100_invoice_document_constraints` — success |
| Deployed commit             | `bf91c767a611ad3e67995fab87c61ccf820cec4d`                                                       |
| Release tag                 | `v0.3.0-beta.1` → `bf91c76`                                                                      |
| Production web              | `https://bizos.qloudihub.com`                                                                    |
| Production API              | `https://api.bizos.qloudihub.com/api/v1/health` → ok                                             |

## Smoke results

Journey: signup → business → customer → quotation → PO → approve → evidence → **Ready to invoice** →
**Create invoice** → PDF preview → send → resend → mobile.

| Check                                            | Result              |
| ------------------------------------------------ | ------------------- |
| Quotation PDF / journey regression               | PASS                |
| PO upload (R2) + approval readiness              | PASS                |
| Create invoice from ready quotation (`INV-0001`) | PASS                |
| Linked PO number on invoice                      | PASS                |
| Invoice PDF preview                              | PASS                |
| Authenticated PDF download                       | PASS (HTTP 200)     |
| Unauthenticated PDF download                     | PASS (HTTP 401)     |
| Unauthenticated invoice API list                 | PASS (HTTP 401)     |
| Cross-tenant PDF access                          | PASS (HTTP 404/401) |
| Invoice email send → Sent                        | PASS                |
| Safe resend → Sent                               | PASS                |
| Mobile 390×844 Sent status + nav                 | PASS                |

Sample QA invoice URL (disposable):
`https://bizos.qloudihub.com/b/90b79bc9-b5c2-4c92-9c27-fae301ec423d/invoices/2600c501-688a-4b61-99a4-14ca86e75f3f`

## Cost

$0 / £0 new spend. Free-tier Render, Prisma Postgres, Cloudflare R2, existing Resend path.

## Known limitations

- Direct invoice create without a quotation is intentionally omitted.
- Payments, receipts, credit notes, and statements remain out of scope.
- Prisma Compute Deploy check fails on PRs (non-blocking; same as prior releases).
- No hard-delete of businesses for QA cleanup; soft-archive invoice only.

## Rollback target

Prior main: `6702389` (application rollback). Do not reverse invoice migrations automatically.
