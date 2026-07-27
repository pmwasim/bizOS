# Production evidence — PO approval readiness

Date: 2026-07-27 (UTC)

## Deployed state

| Item                | Value                                                              |
| ------------------- | ------------------------------------------------------------------ |
| Feature merge       | `c85c8e9` — PR [#24](https://github.com/pmwasim/bizOS/pull/24)     |
| Feature tag         | `v0.2.0-beta.1` → `c85c8e9`                                        |
| R2 env sync         | `34576d9` — PR [#25](https://github.com/pmwasim/bizOS/pull/25)     |
| Deploy wait tooling | `ac6f23f` — PR [#26](https://github.com/pmwasim/bizOS/pull/26)     |
| Release tag         | `v0.2.0-beta.2` → `ac6f23f`                                        |
| API live commit     | `34576d9` (Render deploy `dep-d9jrjqfavr4c73d4k39g` status `live`) |
| Production web      | `https://bizos.qloudihub.com`                                      |
| Production API      | `https://api.bizos.qloudihub.com/api/v1/health` → ok               |

## R2 activation

- Workflow **Sync Render R2 env** upserted `R2_*`, `OBJECT_STORE=r2` onto Render API and redeployed.
- Uploads no longer fall back to ephemeral local disk in production.

## Smoke results

Journey: signup → business → customer → quotation → PDF preview → add PO → upload PO → approve →
upload evidence → **Ready to invoice**.

| Check                                  | Result                    |
| -------------------------------------- | ------------------------- |
| Quotation PDF preview                  | PASS                      |
| PO create (`Approval pending`)         | PASS                      |
| PO file upload                         | PASS (after R2 sync)      |
| Approval → `Approval evidence missing` | PASS                      |
| Evidence → `Ready to invoice`          | PASS                      |
| Authorised file download               | PASS (HTTP 200)           |
| Unauth API PO/list/file                | PASS (HTTP 401)           |
| Unauth web file proxy                  | PASS (HTTP 401)           |
| Cross-tenant web/API access            | PASS (HTTP 404)           |
| Mobile 390×844 readiness               | PASS (`Ready to invoice`) |

Sample QA business (disposable): `79c4541e-e061-4168-beab-61bfb0e1f096` / PO
`2cbc0305-6c02-492b-b836-edca16e352b0`.

## Cost

£0 new spend. Free-tier Render, Prisma Postgres, Cloudflare R2.

## Known limitations

- Prisma Compute Deploy check fails on PRs (non-blocking; same as prior releases).
- Prisma managed backups remain empty on free tier.
- No hard-delete of businesses for QA cleanup; soft-archive PO only.
- Invoice creation is intentionally out of scope.
