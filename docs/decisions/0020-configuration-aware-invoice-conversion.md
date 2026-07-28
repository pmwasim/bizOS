# ADR-0020: Configuration-aware invoice conversion readiness

Status: Accepted

Date: 2026-07-28

Deciders: Product and engineering

## Context

ADR-0018 gated invoice creation on a customer purchase order with readiness `READY_TO_INVOICE`. That
matched the specialized Service PO & Approval process, but after PR #31 every new business receives
Default bizOS ERP, where customer PO and approval evidence are optional. Hard-coding the specialized
gate made Default ERP unable to invoice.

## Decision drivers

- Preserve the live specialized path for businesses assigned `service-po-approval`.
- Allow Default ERP businesses to create an invoice from a sent quotation without a PO.
- Derive the rule from the assigned quotation workflow definition, not from UI flags alone.
- Keep purchase-order linkage optional on the invoice row when no ready PO exists.

## Decision

1. `ConfigurationService.getInvoiceConversionPolicy` inspects the active configuration’s quotation
   workflow. A mandatory `READY_TO_INVOICE` state or convert/mark-ready guards that reference
   purchase orders / approval evidence mean `customerPoRequired=true`.
2. `InvoicesService.createFromQuotation` uses that policy with `canCreateInvoiceFromQuotation`:
   - specialized: require PO readiness `READY_TO_INVOICE`;
   - default: require quotation status `SENT` (PO remains optional enrichment).
3. Quotation PO list responses include `customerPoRequired` and `canCreateInvoice` so the UI can
   show the correct CTA without encoding template codes in the web app.
4. Creating quotations and invoices captures `DocumentWorkflowContext` against the active
   configuration version.

This amends ADR-0018 conversion rules for configuration-aware behavior. Direct invoice create
without a quotation remains out of scope.

## Consequences

- Default ERP users can complete quotation → invoice without fabricating a customer PO.
- Specialized Service PO businesses keep the approval evidence gate.
- Historical invoices may have a null `purchase_order_id` / `po_number_snapshot`.
- Future Sales Order / delivery readiness can extend the same policy derivation.
