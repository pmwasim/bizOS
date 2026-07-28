-- AlterEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- AlterEnum
CREATE TYPE "InvoiceApprovalStatus" AS ENUM ('NOT_RECORDED', 'PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
CREATE TYPE "StoredObjectKind" AS ENUM ('PURCHASE_ORDER', 'APPROVAL_EVIDENCE');

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "business_id" BIGINT NOT NULL,
    "customer_id" BIGINT NOT NULL,
    "quotation_id" BIGINT,
    "po_number" VARCHAR(80) NOT NULL,
    "po_date" DATE,
    "project_reference" VARCHAR(120),
    "amount_minor" DECIMAL(38,0),
    "currency_code" CHAR(3),
    "currency_scale" SMALLINT,
    "notes" VARCHAR(2000),
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'ACTIVE',
    "approval_status" "InvoiceApprovalStatus" NOT NULL DEFAULT 'NOT_RECORDED',
    "approval_changed_at" TIMESTAMPTZ(3),
    "approval_changed_by_user_id" BIGINT,
    "archived_at" TIMESTAMPTZ(3),
    "created_by_membership_id" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stored_objects" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "business_id" BIGINT NOT NULL,
    "purchase_order_id" BIGINT NOT NULL,
    "kind" "StoredObjectKind" NOT NULL,
    "storage_key" VARCHAR(512) NOT NULL,
    "original_filename" VARCHAR(255) NOT NULL,
    "content_type" VARCHAR(120) NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "checksum_sha256" CHAR(64) NOT NULL,
    "uploaded_by_user_id" BIGINT NOT NULL,
    "superseded_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stored_objects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_public_id_key" ON "purchase_orders"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_tenant_id_business_id_id_key" ON "purchase_orders"("tenant_id", "business_id", "id");

-- CreateIndex
CREATE INDEX "purchase_orders_tenant_id_business_id_status_created_at_idx" ON "purchase_orders"("tenant_id", "business_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "purchase_orders_tenant_id_business_id_customer_id_idx" ON "purchase_orders"("tenant_id", "business_id", "customer_id");

-- CreateIndex
CREATE INDEX "purchase_orders_tenant_id_business_id_quotation_id_idx" ON "purchase_orders"("tenant_id", "business_id", "quotation_id");

-- Active PO numbers are unique per customer within a business.
CREATE UNIQUE INDEX "purchase_orders_active_customer_po_number_key"
  ON "purchase_orders"("tenant_id", "business_id", "customer_id", "po_number")
  WHERE "status" = 'ACTIVE';

-- Amount and currency must be set together.
ALTER TABLE "purchase_orders"
  ADD CONSTRAINT "purchase_orders_amount_currency_consistency_check"
  CHECK (
    ("amount_minor" IS NULL AND "currency_code" IS NULL AND "currency_scale" IS NULL)
    OR (
      "amount_minor" IS NOT NULL
      AND "amount_minor" >= 0
      AND "currency_code" IS NOT NULL
      AND "currency_scale" IS NOT NULL
      AND "currency_scale" BETWEEN 0 AND 6
    )
  );

ALTER TABLE "purchase_orders"
  ADD CONSTRAINT "purchase_orders_archive_consistency_check"
  CHECK (
    ("status" = 'ACTIVE' AND "archived_at" IS NULL)
    OR ("status" = 'ARCHIVED' AND "archived_at" IS NOT NULL)
  );

-- CreateIndex
CREATE UNIQUE INDEX "stored_objects_public_id_key" ON "stored_objects"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "stored_objects_tenant_id_business_id_id_key" ON "stored_objects"("tenant_id", "business_id", "id");

-- CreateIndex
CREATE INDEX "stored_objects_tenant_id_business_id_purchase_order_id_kind_created_at_idx"
  ON "stored_objects"("tenant_id", "business_id", "purchase_order_id", "kind", "created_at");

CREATE UNIQUE INDEX "stored_objects_storage_key_key" ON "stored_objects"("storage_key");

ALTER TABLE "stored_objects"
  ADD CONSTRAINT "stored_objects_byte_size_check"
  CHECK ("byte_size" > 0 AND "byte_size" <= 10485760);

ALTER TABLE "stored_objects"
  ADD CONSTRAINT "stored_objects_checksum_format_check"
  CHECK ("checksum_sha256" ~ '^[a-f0-9]{64}$');

-- AddForeignKey
ALTER TABLE "purchase_orders"
  ADD CONSTRAINT "purchase_orders_tenant_id_business_id_fkey"
  FOREIGN KEY ("tenant_id", "business_id") REFERENCES "businesses"("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "purchase_orders"
  ADD CONSTRAINT "purchase_orders_tenant_id_business_id_customer_id_fkey"
  FOREIGN KEY ("tenant_id", "business_id", "customer_id") REFERENCES "customers"("tenant_id", "business_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "purchase_orders"
  ADD CONSTRAINT "purchase_orders_tenant_id_business_id_quotation_id_fkey"
  FOREIGN KEY ("tenant_id", "business_id", "quotation_id") REFERENCES "documents"("tenant_id", "business_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "purchase_orders"
  ADD CONSTRAINT "purchase_orders_tenant_id_created_by_membership_id_fkey"
  FOREIGN KEY ("tenant_id", "created_by_membership_id") REFERENCES "memberships"("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "purchase_orders"
  ADD CONSTRAINT "purchase_orders_approval_changed_by_user_id_fkey"
  FOREIGN KEY ("approval_changed_by_user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stored_objects"
  ADD CONSTRAINT "stored_objects_tenant_id_business_id_fkey"
  FOREIGN KEY ("tenant_id", "business_id") REFERENCES "businesses"("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stored_objects"
  ADD CONSTRAINT "stored_objects_tenant_id_business_id_purchase_order_id_fkey"
  FOREIGN KEY ("tenant_id", "business_id", "purchase_order_id") REFERENCES "purchase_orders"("tenant_id", "business_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stored_objects"
  ADD CONSTRAINT "stored_objects_uploaded_by_user_id_fkey"
  FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS for new business-scoped tables
DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'purchase_orders',
    'stored_objects'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_business_isolation ON %I
       USING (
         tenant_id = bizo_current_tenant_id()
         AND business_id = bizo_current_business_id()
       )
       WITH CHECK (
         tenant_id = bizo_current_tenant_id()
         AND business_id = bizo_current_business_id()
       )',
      table_name
    );
  END LOOP;
END
$$;
