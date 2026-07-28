# ADR-0016: Purchase order, approval evidence, and invoice readiness

Status: Accepted

Date: 2026-07-27

Deciders: Product and engineering

## Context

PRD v3.0 Next Release requires recording a customer purchase order, linking it to a quotation,
capturing invoice-approval evidence, and showing whether the transaction is ready to invoice —
without implementing invoices. ADR-0013 reserves `Document` for versioned commercial document types
with quotation-style lifecycles. A customer PO is an inbound commercial reference with files and
approval state, not a numbered outbound PDF document.

## Decision drivers

- Ship one vertical outcome without destabilising quotations.
- Keep tenant and same-business integrity.
- Prefer the smallest safe cardinality.
- Derive readiness when rules are reliable.
- Preserve immutable evidence (no silent delete of uploaded files).
- Remain at £0 operating cost.

## Options considered

1. Extend `DocumentType` with `PURCHASE_ORDER` — reuses tables but forces PO into quotation
   numbering, lines, versions, and send semantics.
2. Separate `PurchaseOrder` + `StoredObject` aggregates with a dedicated service — explicit
   lifecycle, clearer authz, additive schema.
3. Generic workflow engine (ADR-0006) — too large for this release.

## Decision

### Aggregate

Introduce `purchase_orders` and `stored_objects` tables with FORCE RLS, scoped by
`(tenant_id, business_id)`. Do **not** add a `DocumentType` value in this release.

### Cardinality

- One PO belongs to one business and one customer.
- One PO may link to **at most one** primary quotation (`quotation_id` nullable until linked).
- One quotation may have **zero or more** POs.
- Multi-quotation allocation on a single PO is deferred.

### Duplicate PO numbers

Unique on `(tenant_id, business_id, customer_id, po_number)` among non-archived rows (partial unique
index where `status = 'ACTIVE'`). Different customers may reuse numbers.

### Required fields on create

- `customerId` (same business)
- `poNumber` (trimmed, 1–80 chars)
- Optional: `poDate`, `quotationId`, `projectReference`, `amountMinor` + currency, `notes`

### Files

- At most one active PO file and one active approval-evidence file per PO (replace creates a new
  `stored_objects` row; prior rows remain for audit integrity; downloads use the latest active
  object of each kind).
- Allowed types: PDF, JPEG, PNG, WebP. Max 10 MiB.
- Object keys:
  `tenants/{tenantPublicId}/businesses/{businessPublicId}/purchase-orders/{poPublicId}/{filePublicId}/{safeFilename}`
  and `.../approval-evidence/...` for evidence.
- No permanent public URLs; bytes served only through authorised API download.

### Approval states

`NOT_RECORDED` | `PENDING` | `APPROVED` | `REJECTED`

- Who may change approval or upload evidence: `OWNER` and `ADMIN` only.
- Who may create/update/upload PO files/read: `OWNER`, `ADMIN`, and `MEMBER`.
- Who may archive: `OWNER` and `ADMIN`.
- Every approval change audits `before`/`after`, actor, and timestamp.

### Readiness (derived, not stored)

Evaluated per PO (and summarised on the quotation):

| Code                        | User language                 | Rule                                                  |
| --------------------------- | ----------------------------- | ----------------------------------------------------- |
| `MISSING_CUSTOMER_PO`       | Missing customer PO           | Quotation has no active linked PO                     |
| `PO_RECORDED`               | PO recorded                   | Active PO exists; approval not yet blocking           |
| `APPROVAL_PENDING`          | Approval pending              | Approval is `NOT_RECORDED` or `PENDING`               |
| `APPROVAL_EVIDENCE_MISSING` | Approval evidence missing     | Approval is `APPROVED` and no evidence file           |
| `READY_TO_INVOICE`          | Ready to invoice              | Linked quotation + `APPROVED` + evidence file present |
| `NOT_READY_REJECTED`        | Not ready (approval declined) | Approval is `REJECTED`                                |

Priority when multiple apply: `READY_TO_INVOICE` > `APPROVAL_EVIDENCE_MISSING` > `APPROVAL_PENDING`
/ `NOT_READY_REJECTED` > `PO_RECORDED`. Quotation summary is the **best** readiness among active
linked POs, else `MISSING_CUSTOMER_PO`.

### Archive / deletion

- Soft archive (`status = ARCHIVED`, `archived_at` set). No hard delete of POs or files in this
  release.
- Archived POs do not contribute to readiness.
- Cascade delete of business evidence is forbidden (`onDelete: Restrict` on evidence FKs).

### Authorization objects

Casbin-style permissions (colon form matching existing map):

- `purchase_orders:create|read|update|archive|upload`
- `approvals:read|update|upload_evidence`

## Consequences

Quotations remain unchanged as a document type. Invoice creation stays out of scope. A later invoice
slice can require `READY_TO_INVOICE` before conversion.

## Validation and review trigger

Cross-tenant denial, same-business quotation link checks, duplicate PO number, readiness matrix,
authorised vs unauthorised download, approval audit before/after, quotation regression. Revisit
cardinality when product evidence requires multi-quotation POs.
