# ADR-0018: Invoice document slice on shared commercial facts

Status: Accepted

Date: 2026-07-28

Deciders: Product and engineering

## Context

PRD v3.0 Release 3 requires converting a ready-to-invoice quotation into a sent customer invoice
with PDF and email delivery. ADR-0013 reserved `Document` for versioned commercial document types
and required a dedicated ADR, service, authorization map, and lifecycle tests for any second type.
ADR-0016 left invoice creation out of scope and recommended gating on `READY_TO_INVOICE`.

## Decision drivers

- Ship one complete vertical outcome without payments or statements.
- Reuse money, parties, numbering, PDF, email, audit, and storage seams.
- Keep quotation and PO behaviour unchanged.
- Preserve immutable sent artifacts and truthful delivery status.
- Remain at £0 operating cost.

## Options considered

1. Separate `Invoice` tables parallel to `documents` — clearest isolation, duplicates
   lines/versions/ deliveries and calculator plumbing.
2. Generic workflow engine for invoice states — exceeds release scope (ADR-0006).
3. Extend `DocumentType` with `INVOICE` and an invoice-specific application service — reuses facts,
   keeps lifecycle explicit.

## Decision

### Aggregate

Add `DocumentType.INVOICE`. Invoice behaviour lives in `InvoicesService` (not inside
`QuotationsService`). Shared tables remain `documents`, `document_lines`, `document_versions`, and
`document_deliveries`.

### Status model

Extend `DocumentStatus`:

| Status          | User language | Meaning                                  |
| --------------- | ------------- | ---------------------------------------- |
| `DRAFT`         | Draft         | Editable working copy                    |
| `READY_TO_SEND` | Ready to send | Validated; send allowed                  |
| `SENT`          | Sent          | Email succeeded for an immutable version |
| `SEND_FAILED`   | Send failed   | Immutable version exists; email failed   |
| `ARCHIVED`      | Archived      | Soft-archived; linked records preserved  |

Quotations continue to use only `DRAFT` and `SENT`. Illegal transitions are rejected server-side.

### Transition rules

1. Create from ready quotation → `READY_TO_SEND` (copied facts are complete).
2. Update while `DRAFT` or `READY_TO_SEND` → remains editable; update sets `DRAFT`.
3. Mark ready (`DRAFT` → `READY_TO_SEND`) when lines and dates are valid.
4. First send (`READY_TO_SEND` only): create immutable version; attempt email.
   - Success → `SENT` + delivery `SENT` + PDF stored in object store.
   - Failure → `SEND_FAILED` + delivery `FAILED` (document is **not** `SENT`).
5. Resend (`SENT` or `SEND_FAILED`): reuse selected immutable version; success moves `SEND_FAILED` →
   `SENT`; never mutates snapshot or historical totals.
6. Archive (`DRAFT` / `READY_TO_SEND` / `SEND_FAILED` / `SENT` → `ARCHIVED`): soft archive only.
7. No edits after version finalization (`SENT` / `SEND_FAILED` / `ARCHIVED`).

### Conversion rules

- Conversion is configuration-aware (ADR-0020). Businesses on Service PO & Approval still require an
  authorized quotation in the same business and at least one active linked PO with readiness
  `READY_TO_INVOICE`. Default ERP allows conversion from a sent quotation without a customer PO.
- Copy customer snapshot fields via customer FK + copied line inputs; copy currency, quantities,
  prices, tax inputs, and totals; recalculate server-side and verify against copied totals.
- When a ready PO exists, copy its number into `po_number_snapshot` and optional
  `purchase_order_id`; copy project/reference when present. Otherwise leave those fields null.
- After copy, the invoice does not live-bind to quotation line mutations.
- Direct invoice creation without a quotation is **out of scope** for this release so the readiness
  workflow is not weakened.

### Numbering

- Separate sequence: `business_settings.invoice_prefix` (default `INV`) and `next_invoice_number`,
  allocated atomically with `UPDATE … SET next = next + 1`.
- Unique `(tenant_id, business_id, type, number)` already enforces business-local uniqueness per
  type. No renumbering; archival does not free numbers.

### PDF and storage

- Render with the existing PDF adapter using an invoice template.
- On successful finalize/send path, store PDF bytes via the existing object store under
  `tenants/{tenantPublicId}/businesses/{businessPublicId}/invoices/{invoicePublicId}/versions/{versionPublicId}/invoice.pdf`.
- Sent PDF metadata (key, content type, size, sha256) is recorded on `document_versions`.
- Preview for sent invoices prefers stored bytes; drafts regenerate from current facts.
- No permanent public URLs; downloads are authorized application routes only.

### Authorization

Permissions mapped through existing role templates:

| Permission         | OWNER | ADMIN | MEMBER |
| ------------------ | ----- | ----- | ------ |
| `invoices:read`    | yes   | yes   | yes    |
| `invoices:create`  | yes   | yes   | yes    |
| `invoices:update`  | yes   | yes   | yes    |
| `invoices:send`    | yes   | yes   | yes    |
| `invoices:archive` | yes   | yes   | no     |
| `invoices:export`  | yes   | yes   | yes    |

Deny by default; same-business checks on quotation, customer, and PO identifiers.

### Explicit non-goals

Payments, receipts, credit notes, statements, overdue automation, recurring invoices, customer
portal, payment gateways, OCR/AI, accounting postings, ZATCA Phase 2, configurable approval
workflows, batch invoicing, inventory deductions.

## Consequences

Quotations and POs remain operational on the additive schema. Invoice lifecycle is explicit and
testable. A later payment/statement slice can reference sent invoices without rewriting document
facts.

## Validation and review trigger

Validate readiness gate, conversion mapping, exact totals, numbering concurrency, immutable sent
versions, failed-send status honesty, R2 PDF access control, cross-tenant denial, quotation/PO
regression, desktop and 390px mobile journeys. Revisit when payments or credit notes require invoice
balance semantics.
