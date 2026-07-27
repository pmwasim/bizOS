# Invoice vertical slice — implementation checkpoint

Date: 2026-07-28 (UTC)

## Authoritative state

| Item                           | Value                                                        |
| ------------------------------ | ------------------------------------------------------------ |
| Current main SHA               | `67023898373054b2ccb47101ebce988af677c325`                   |
| Release tag                    | `v0.2.0-beta.2` → `ac6f23f8a125056507cc6de97b6ad4353f3bec4f` |
| Production API (last evidence) | `34576d9` with `OBJECT_STORE=r2` (PO readiness evidence)     |
| Production web                 | `https://bizos.qloudihub.com`                                |
| Worktree                       | Clean except untracked `.cursor/` (ignored for shipping)     |
| Feature branch                 | `feature/invoice-vertical-slice`                             |

Main at checkpoint is docs-ahead of the tagged beta.2 tooling commit; production remains the PO
readiness slice plus R2.

## Existing reusable components

- Shared `documents` / `document_lines` / `document_versions` / `document_deliveries` (ADR-0013)
- Exact-money calculator (`@bizo/contracts/money`, quotation calculator pattern)
- Atomic numbering via `business_settings.next_*` increment
- PDFKit professional template (`PdfService`)
- SMTP / Resend HTTPS mail (`MailService`)
- Object store abstraction + R2 (`@bizo/storage`, PO upload path)
- Casbin-backed `BusinessAccessService` role permissions
- `AuditEvent` + delivery attempt rows
- Derived PO readiness (`READY_TO_INVOICE`) as conversion gate
- Playwright journeys and API integration tests

## Proposed invoice scope

Ready quotation → draft invoice (copied lines/totals/PO) → review/edit draft → PDF preview → send →
delivery status → safe resend → archive → list/detail/nav.

## Excluded scope

Payments, receipts, credit notes, statements, overdue automation, recurring invoices, public portal,
payment gateway, OCR/AI, GL/accounting, ZATCA Phase 2, configurable workflows, batch invoicing,
inventory, direct invoice create without quotation (deferred; readiness gate stays authoritative).

## Migration plan

Additive only:

1. Extend `DocumentType` with `INVOICE`.
2. Extend `DocumentStatus` with `READY_TO_SEND`, `SEND_FAILED`, `ARCHIVED` (quotations keep
   `DRAFT`/`SENT`).
3. Add invoice fields on `documents` (due date, source quotation, PO link + snapshot, project
   reference, archive timestamp, notes).
4. Add invoice numbering settings on `business_settings`.
5. Add optional PDF artifact metadata on `document_versions`.
6. Same-business FKs + indexes; no reverse migration on rollback.

## Rollback implications

- Application rollback to prior main stops serving invoice routes; schema columns/enums remain
  (forward-compatible).
- Do not auto-reverse the migration.
- Sent invoice versions and R2 PDF keys remain intact for forensic recovery.
- Quotation and PO paths must keep working on the additive schema without code that depends on
  invoice-only statuses.
