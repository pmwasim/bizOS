-- AlterEnum (new labels must not be referenced until a later migration commits)
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'INVOICE';
ALTER TYPE "DocumentStatus" ADD VALUE IF NOT EXISTS 'READY_TO_SEND';
ALTER TYPE "DocumentStatus" ADD VALUE IF NOT EXISTS 'SEND_FAILED';
ALTER TYPE "DocumentStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';

-- AlterTable business_settings
ALTER TABLE "business_settings"
  ADD COLUMN "invoice_prefix" VARCHAR(12) NOT NULL DEFAULT 'INV',
  ADD COLUMN "next_invoice_number" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "invoice_due_days" SMALLINT NOT NULL DEFAULT 30;

ALTER TABLE "business_settings"
  ADD CONSTRAINT "business_settings_invoice_due_days_check"
  CHECK ("invoice_due_days" BETWEEN 1 AND 365);

ALTER TABLE "business_settings"
  ADD CONSTRAINT "business_settings_next_invoice_number_check"
  CHECK ("next_invoice_number" >= 1);

-- AlterTable documents (columns + indexes + FKs; enum checks deferred)
ALTER TABLE "documents"
  ADD COLUMN "due_date" DATE,
  ADD COLUMN "source_quotation_id" BIGINT,
  ADD COLUMN "purchase_order_id" BIGINT,
  ADD COLUMN "project_reference" VARCHAR(120),
  ADD COLUMN "po_number_snapshot" VARCHAR(80),
  ADD COLUMN "notes" VARCHAR(2000),
  ADD COLUMN "archived_at" TIMESTAMPTZ(3);

DROP INDEX IF EXISTS "documents_tenant_id_business_id_status_created_at_idx";

CREATE INDEX "documents_tenant_id_business_id_type_status_created_at_idx"
  ON "documents"("tenant_id", "business_id", "type", "status", "created_at");

CREATE INDEX "documents_tenant_id_business_id_source_quotation_id_idx"
  ON "documents"("tenant_id", "business_id", "source_quotation_id");

CREATE INDEX "documents_tenant_id_business_id_purchase_order_id_idx"
  ON "documents"("tenant_id", "business_id", "purchase_order_id");

ALTER TABLE "documents"
  ADD CONSTRAINT "documents_source_quotation_fkey"
  FOREIGN KEY ("tenant_id", "business_id", "source_quotation_id")
  REFERENCES "documents"("tenant_id", "business_id", "id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE "documents"
  ADD CONSTRAINT "documents_purchase_order_fkey"
  FOREIGN KEY ("tenant_id", "business_id", "purchase_order_id")
  REFERENCES "purchase_orders"("tenant_id", "business_id", "id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE "documents"
  ADD CONSTRAINT "documents_due_date_issue_date_check"
  CHECK ("due_date" IS NULL OR "due_date" >= "issue_date");

-- AlterTable document_versions
ALTER TABLE "document_versions"
  ADD COLUMN "pdf_storage_key" VARCHAR(512),
  ADD COLUMN "pdf_content_type" VARCHAR(120),
  ADD COLUMN "pdf_byte_size" INTEGER,
  ADD COLUMN "pdf_checksum_sha256" CHAR(64);

ALTER TABLE "document_versions"
  ADD CONSTRAINT "document_versions_pdf_artifact_consistency_check"
  CHECK (
    (
      "pdf_storage_key" IS NULL
      AND "pdf_content_type" IS NULL
      AND "pdf_byte_size" IS NULL
      AND "pdf_checksum_sha256" IS NULL
    )
    OR (
      "pdf_storage_key" IS NOT NULL
      AND "pdf_content_type" IS NOT NULL
      AND "pdf_byte_size" IS NOT NULL
      AND "pdf_byte_size" > 0
      AND "pdf_checksum_sha256" IS NOT NULL
    )
  );
