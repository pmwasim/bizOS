# Release notes draft — Purchase order and approval readiness

Released tags: `v0.2.0-beta.1` (feature `c85c8e9`), `v0.2.0-beta.2` (R2 live / ops `ac6f23f`).

See `docs/operations/po-approval-readiness-production-evidence.md`.

## User outcome

After a quotation is accepted, a business user can record or upload a customer purchase order, link
it to the quotation, record invoice approval with evidence, and see whether the transaction is
**Ready to invoice**.

## Included

- Purchase order create / list / detail / update / archive
- PO file and approval-evidence upload (private object store)
- Approval status with audited before/after
- Derived readiness on PO and quotation screens
- Tenant isolation and authorised downloads
- Desktop and mobile journeys

## Excluded

Invoices, payments, OCR/AI, automatic matching, multi-level approvals, customer portal.

## Zero-budget confirmation

No new paid services. Uses existing Render, Prisma Postgres, Cloudflare R2 (free tier), and existing
npm libraries (AWS SDK already present). CI uses local object store.

## Rollback

- Feature is additive (new tables/routes). Rollback: redeploy previous release; leave unused tables
  in place (forward-safe). Do not drop evidence tables without an explicit data decision.

## Production

- API live with R2: `34576d9`
- Evidence: `docs/operations/po-approval-readiness-production-evidence.md`
- Feedback checklist: `docs/operations/po-approval-readiness-beta-feedback.md`
