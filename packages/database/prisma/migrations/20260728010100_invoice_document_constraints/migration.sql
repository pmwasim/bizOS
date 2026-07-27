-- Enum labels from 20260728010000 are usable after that migration commits.

ALTER TABLE "documents"
  ADD CONSTRAINT "documents_archive_consistency_check"
  CHECK (
    ("status"::text <> 'ARCHIVED' AND "archived_at" IS NULL)
    OR ("status"::text = 'ARCHIVED' AND "archived_at" IS NOT NULL)
  );

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
  );
