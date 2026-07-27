# Checkpoint — PO + approval readiness slice

Date: 2026-07-27  
Branch: `feature/po-approval-readiness`  
PRD: bizOS PRD v3.0 §11.2 Next Release

## Authoritative starting state

| Item                   | Value                                          |
| ---------------------- | ---------------------------------------------- |
| `main` SHA             | `2c8734f79f4a92c4badeccfa04e534f6c110a178`     |
| Release tag            | `v0.1.0-beta.1`                                |
| Production web         | `https://bizos.qloudihub.com` HTTP 200         |
| Production API         | health `ok`                                    |
| Last Production deploy | SHA `7b2c080` (PDF fix); ops docs at `2c8734f` |
| Worktree               | clean aside from local `.cursor/`              |
| Open product PRs       | docs draft #23; dependabot noise               |

## Current architecture (reusable)

- NestJS API + Next.js web + Prisma/PostgreSQL + Auth.js + Casbin (`BusinessAccessService`)
- Quotation journey via `Document` (`QUOTATION` only) — protected
- Audit via inline `auditEvent.create`
- Storage package: R2 client factory + key helpers; **no app put/get yet**
- Money: minor units `Decimal(38,0)` + scale

## Exact MVP scope

1. Create/list/view/update/archive purchase orders
2. Upload PO file + approval evidence (private object store)
3. Link PO to one primary quotation (same business + customer)
4. Record invoice-approval status with actor/time/before/after audit
5. Derive and display “Ready to invoice”
6. Quotation detail shows linked POs + readiness
7. Tenant isolation + authorised downloads
8. Desktop + 390px mobile

## Excluded

OCR, AI, auto-matching, invoices, payments, multi-level approvals, customer portal, CRM, inventory,
paid services, DocumentType generalization for PO.

## Schema changes required

- `PurchaseOrder` aggregate (not a `DocumentType`)
- `StoredObject` metadata for PO file + approval evidence
- Approval enums + archive status
- RLS on new tables
- Additive migration only

## Risks

- R2 app path newly activated — use LocalObjectStore for CI/dev; R2 when credentials present (Render
  FS ephemeral)
- Approval restricted to OWNER/ADMIN — document clearly
- Duplicate PO numbers scoped to `(business, customer)`
- Must not regress quotation send/PDF/email

## Zero-budget

Reuse existing free Render, Prisma Postgres, Cloudflare R2 (already provisioned), Resend. No new
paid services. No new npm frameworks; prefer existing Zod/Nest/shadcn/AWS SDK.
