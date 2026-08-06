-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('DRAFT', 'COMPLETED', 'REVERSED');

-- DropIndex
DROP INDEX "stored_objects_storage_key_key";

-- CreateTable
CREATE TABLE "payments" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "business_id" BIGINT NOT NULL,
    "type" "PaymentType" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'DRAFT',
    "payment_date" DATE NOT NULL,
    "amount_minor" DECIMAL(38,0) NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "currency_scale" SMALLINT NOT NULL,
    "reference" VARCHAR(120),
    "notes" VARCHAR(2000),
    "created_by_membership_id" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "business_id" BIGINT NOT NULL,
    "payment_id" BIGINT NOT NULL,
    "document_id" BIGINT,
    "purchase_order_id" BIGINT,
    "amount_minor" DECIMAL(38,0) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payments_public_id_key" ON "payments"("public_id");

-- CreateIndex
CREATE INDEX "payments_tenant_id_business_id_status_created_at_idx" ON "payments"("tenant_id", "business_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payments_tenant_id_business_id_id_key" ON "payments"("tenant_id", "business_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_allocations_public_id_key" ON "payment_allocations"("public_id");

-- CreateIndex
CREATE INDEX "payment_allocations_tenant_id_business_id_payment_id_idx" ON "payment_allocations"("tenant_id", "business_id", "payment_id");

-- CreateIndex
CREATE INDEX "payment_allocations_tenant_id_business_id_document_id_idx" ON "payment_allocations"("tenant_id", "business_id", "document_id");

-- CreateIndex
CREATE INDEX "payment_allocations_tenant_id_business_id_purchase_order_id_idx" ON "payment_allocations"("tenant_id", "business_id", "purchase_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_allocations_tenant_id_business_id_id_key" ON "payment_allocations"("tenant_id", "business_id", "id");

-- RenameForeignKey
ALTER TABLE "business_configuration_assignments" RENAME CONSTRAINT "business_configuration_assignments_assigned_by_membership_id_fk" TO "business_configuration_assignments_assigned_by_membership__fkey";

-- RenameForeignKey
ALTER TABLE "document_deliveries" RENAME CONSTRAINT "document_deliveries_tenant_id_business_id_document_id_document_" TO "document_deliveries_tenant_id_business_id_document_id_docu_fkey";

-- RenameForeignKey
ALTER TABLE "documents" RENAME CONSTRAINT "documents_purchase_order_fkey" TO "documents_tenant_id_business_id_purchase_order_id_fkey";

-- RenameForeignKey
ALTER TABLE "documents" RENAME CONSTRAINT "documents_source_quotation_fkey" TO "documents_tenant_id_business_id_source_quotation_id_fkey";

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_id_business_id_fkey" FOREIGN KEY ("tenant_id", "business_id") REFERENCES "businesses"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_id_created_by_membership_id_fkey" FOREIGN KEY ("tenant_id", "created_by_membership_id") REFERENCES "memberships"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_tenant_id_business_id_fkey" FOREIGN KEY ("tenant_id", "business_id") REFERENCES "businesses"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_tenant_id_business_id_payment_id_fkey" FOREIGN KEY ("tenant_id", "business_id", "payment_id") REFERENCES "payments"("tenant_id", "business_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_tenant_id_business_id_document_id_fkey" FOREIGN KEY ("tenant_id", "business_id", "document_id") REFERENCES "documents"("tenant_id", "business_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_tenant_id_business_id_purchase_order_i_fkey" FOREIGN KEY ("tenant_id", "business_id", "purchase_order_id") REFERENCES "purchase_orders"("tenant_id", "business_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "business_configuration_assignments_assigned_by_membership_id_id" RENAME TO "business_configuration_assignments_assigned_by_membership_i_idx";

-- RenameIndex
ALTER INDEX "stored_objects_tenant_id_business_id_purchase_order_id_kind_cre" RENAME TO "stored_objects_tenant_id_business_id_purchase_order_id_kind_idx";
