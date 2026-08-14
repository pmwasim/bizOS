-- `documents_invoice_fields_check` (20260728010100_invoice_document_constraints) was written
-- when DocumentType had only QUOTATION and INVOICE. The 20260807000000 migration extended
-- DocumentType with SALES_ORDER, DELIVERY_NOTE, SERVICE_COMPLETION, SUPPLIER_QUOTATION,
-- SUPPLIER_PURCHASE_ORDER, SUPPLIER_BILL, GOODS_RECEIPT_NOTE, CREDIT_NOTE, and DEBIT_NOTE, but
-- the CHECK constraint was never updated — its two branches only ever match QUOTATION or
-- INVOICE, so every insert of any other document type violates it unconditionally.
--
-- This migration preserves the existing QUOTATION/INVOICE rules exactly and adds a permissive
-- branch for every other document type. No field-level invariants are defined yet for the new
-- types; tightening this later (e.g. requiring delivery_date on DELIVERY_NOTE) is a follow-up.

ALTER TABLE "documents" DROP CONSTRAINT "documents_invoice_fields_check";

ALTER TABLE "documents"
  ADD CONSTRAINT "documents_invoice_fields_check"
  CHECK (
    (
      "type"::text = 'QUOTATION'
      AND "due_date" IS NULL
      AND "source_quotation_id" IS NULL
      AND "purchase_order_id" IS NULL
      AND "po_number_snapshot" IS NULL
      AND "project_reference" IS NULL
      AND "notes" IS NULL
    )
    OR (
      "type"::text = 'INVOICE'
      AND "due_date" IS NOT NULL
      AND "due_date" >= "issue_date"
    )
    OR "type"::text NOT IN ('QUOTATION', 'INVOICE')
  );
