-- Numbering for the new supplier procurement documents (supplier purchase orders, supplier
-- bills). Kept separate from the existing (unused) purchase_order_prefix/next_purchase_order_number
-- columns, which belong conceptually to the inbound customer-PO module and are not touched here.
ALTER TABLE "business_settings"
  ADD COLUMN "supplier_po_prefix" VARCHAR(12) NOT NULL DEFAULT 'SPO',
  ADD COLUMN "next_supplier_po_number" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "supplier_bill_prefix" VARCHAR(12) NOT NULL DEFAULT 'BILL',
  ADD COLUMN "next_supplier_bill_number" INTEGER NOT NULL DEFAULT 1;

-- documents.customer_id was NOT NULL, which only ever fit the customer-facing document types.
-- Supplier-facing types (SUPPLIER_QUOTATION, SUPPLIER_PURCHASE_ORDER, SUPPLIER_BILL,
-- GOODS_RECEIPT_NOTE) have a supplier, not a customer, on the other side of the transaction, so
-- this column must be nullable for those rows. Enforced per-type in the service layer rather than
-- a DB CHECK constraint -- see documents_invoice_fields_check's history in this same migrations
-- directory for why a per-type CHECK constraint here is a maintenance trap as new types are added.
ALTER TABLE "documents" ALTER COLUMN "customer_id" DROP NOT NULL;
