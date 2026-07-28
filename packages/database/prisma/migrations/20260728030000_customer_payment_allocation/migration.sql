-- AlterEnum
CREATE TYPE "CustomerPaymentStatus" AS ENUM ('RECORDED', 'VOIDED');

-- AlterEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'CASH', 'CARD', 'CHEQUE', 'OTHER');

-- AlterTable
ALTER TABLE "business_settings"
  ADD COLUMN "payment_prefix" VARCHAR(12) NOT NULL DEFAULT 'PAY',
  ADD COLUMN "next_payment_number" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "business_settings"
  ADD CONSTRAINT "business_settings_payment_prefix_check"
  CHECK ("payment_prefix" ~ '^[A-Z0-9-]{1,12}$');

ALTER TABLE "business_settings"
  ADD CONSTRAINT "business_settings_next_payment_number_check"
  CHECK ("next_payment_number" >= 1);

-- CreateTable
CREATE TABLE "customer_payments" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "business_id" BIGINT NOT NULL,
    "customer_id" BIGINT NOT NULL,
    "number" VARCHAR(40) NOT NULL,
    "status" "CustomerPaymentStatus" NOT NULL DEFAULT 'RECORDED',
    "received_on" DATE NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" VARCHAR(120),
    "notes" VARCHAR(2000),
    "currency_code" CHAR(3) NOT NULL,
    "currency_scale" SMALLINT NOT NULL,
    "amount_minor" DECIMAL(38,0) NOT NULL,
    "voided_at" TIMESTAMPTZ(3),
    "void_reason" VARCHAR(500),
    "created_by_membership_id" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "customer_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "business_id" BIGINT NOT NULL,
    "payment_id" BIGINT NOT NULL,
    "invoice_document_id" BIGINT NOT NULL,
    "amount_minor" DECIMAL(38,0) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_payments_public_id_key" ON "customer_payments"("public_id");
CREATE UNIQUE INDEX "customer_payments_tenant_id_business_id_id_key" ON "customer_payments"("tenant_id", "business_id", "id");
CREATE UNIQUE INDEX "customer_payments_tenant_id_business_id_number_key" ON "customer_payments"("tenant_id", "business_id", "number");
CREATE INDEX "customer_payments_tenant_id_business_id_status_received_on_idx" ON "customer_payments"("tenant_id", "business_id", "status", "received_on");
CREATE INDEX "customer_payments_tenant_id_business_id_customer_id_idx" ON "customer_payments"("tenant_id", "business_id", "customer_id");

CREATE UNIQUE INDEX "payment_allocations_public_id_key" ON "payment_allocations"("public_id");
CREATE UNIQUE INDEX "payment_allocations_tenant_id_business_id_id_key" ON "payment_allocations"("tenant_id", "business_id", "id");
CREATE UNIQUE INDEX "payment_allocations_tenant_business_payment_invoice_key" ON "payment_allocations"("tenant_id", "business_id", "payment_id", "invoice_document_id");
CREATE INDEX "payment_allocations_tenant_id_business_id_invoice_document_id_idx" ON "payment_allocations"("tenant_id", "business_id", "invoice_document_id");
CREATE INDEX "payment_allocations_tenant_id_business_id_payment_id_idx" ON "payment_allocations"("tenant_id", "business_id", "payment_id");

-- Checks
ALTER TABLE "customer_payments"
  ADD CONSTRAINT "customer_payments_amount_positive_check"
  CHECK ("amount_minor" > 0);

ALTER TABLE "customer_payments"
  ADD CONSTRAINT "customer_payments_currency_scale_check"
  CHECK ("currency_scale" >= 0 AND "currency_scale" <= 6);

ALTER TABLE "customer_payments"
  ADD CONSTRAINT "customer_payments_void_consistency_check"
  CHECK (
    ("status" = 'RECORDED' AND "voided_at" IS NULL)
    OR ("status" = 'VOIDED' AND "voided_at" IS NOT NULL)
  );

ALTER TABLE "payment_allocations"
  ADD CONSTRAINT "payment_allocations_amount_positive_check"
  CHECK ("amount_minor" > 0);

-- Foreign keys
ALTER TABLE "customer_payments"
  ADD CONSTRAINT "customer_payments_tenant_id_business_id_fkey"
  FOREIGN KEY ("tenant_id", "business_id") REFERENCES "businesses"("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "customer_payments"
  ADD CONSTRAINT "customer_payments_tenant_id_business_id_customer_id_fkey"
  FOREIGN KEY ("tenant_id", "business_id", "customer_id") REFERENCES "customers"("tenant_id", "business_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "customer_payments"
  ADD CONSTRAINT "customer_payments_tenant_id_created_by_membership_id_fkey"
  FOREIGN KEY ("tenant_id", "created_by_membership_id") REFERENCES "memberships"("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payment_allocations"
  ADD CONSTRAINT "payment_allocations_tenant_id_business_id_fkey"
  FOREIGN KEY ("tenant_id", "business_id") REFERENCES "businesses"("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payment_allocations"
  ADD CONSTRAINT "payment_allocations_tenant_id_business_id_payment_id_fkey"
  FOREIGN KEY ("tenant_id", "business_id", "payment_id") REFERENCES "customer_payments"("tenant_id", "business_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payment_allocations"
  ADD CONSTRAINT "payment_allocations_tenant_id_business_id_invoice_document_id_fkey"
  FOREIGN KEY ("tenant_id", "business_id", "invoice_document_id") REFERENCES "documents"("tenant_id", "business_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS
DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'customer_payments',
    'payment_allocations'
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
