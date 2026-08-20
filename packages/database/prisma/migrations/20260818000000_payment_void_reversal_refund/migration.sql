-- Payment voiding, reversal & refund accounting (TASK-15).
--
-- Adds a terminal VOIDED status for draft payments and an append-only payment_refunds ledger so the
-- net customer/invoice position stays derived (payment amount less the sum of its refunds) rather
-- than mutating the original payment. See docs/decisions/0025-payment-void-reversal-refund.md.

-- AlterEnum: terminal status for a draft payment that never settled anything. The new value is not
-- referenced in this migration, so adding it inside the migration transaction is safe.
ALTER TYPE "PaymentStatus" ADD VALUE 'VOIDED';

-- CreateTable
CREATE TABLE "payment_refunds" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "business_id" BIGINT NOT NULL,
    "payment_id" BIGINT NOT NULL,
    "amount_minor" DECIMAL(38,0) NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "currency_scale" SMALLINT NOT NULL,
    "reason" VARCHAR(500),
    "created_by_membership_id" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_refunds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_refunds_public_id_key" ON "payment_refunds"("public_id");

-- CreateIndex
CREATE INDEX "payment_refunds_tenant_id_business_id_payment_id_idx" ON "payment_refunds"("tenant_id", "business_id", "payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_refunds_tenant_id_business_id_id_key" ON "payment_refunds"("tenant_id", "business_id", "id");

-- AddForeignKey
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_tenant_id_business_id_fkey" FOREIGN KEY ("tenant_id", "business_id") REFERENCES "businesses"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_tenant_id_business_id_payment_id_fkey" FOREIGN KEY ("tenant_id", "business_id", "payment_id") REFERENCES "payments"("tenant_id", "business_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_tenant_id_created_by_membership_id_fkey" FOREIGN KEY ("tenant_id", "created_by_membership_id") REFERENCES "memberships"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enable and Force Row Level Security with the tenant_business_isolation policy, matching every other
-- business-scoped table (see 20260807050000_enable_rls_missing_tables).
ALTER TABLE "payment_refunds" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_refunds" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_business_isolation ON "payment_refunds"
  USING (
    tenant_id = bizo_current_tenant_id()
    AND business_id = bizo_current_business_id()
  )
  WITH CHECK (
    tenant_id = bizo_current_tenant_id()
    AND business_id = bizo_current_business_id()
  );
