-- New greenfield CRM interaction journal. Additive only: a new enum, a new
-- table and its indexes/foreign keys. (Prisma also proposed dropping and
-- recreating unrelated, unchanged foreign keys on `opportunities` and
-- `projects`; that churn was removed as it is a no-op.)

-- CreateEnum
CREATE TYPE "CrmActivityType" AS ENUM ('NOTE', 'CALL', 'EMAIL', 'MEETING', 'STAGE_CHANGE');

-- CreateTable
CREATE TABLE "crm_activities" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "business_id" BIGINT NOT NULL,
    "type" "CrmActivityType" NOT NULL,
    "subject" VARCHAR(200) NOT NULL,
    "body" VARCHAR(4000),
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,
    "customer_id" BIGINT,
    "opportunity_id" BIGINT,
    "lead_id" BIGINT,
    "actor_membership_id" BIGINT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "crm_activities_public_id_key" ON "crm_activities"("public_id");

-- CreateIndex
CREATE INDEX "crm_activities_tenant_id_business_id_customer_id_occurred_a_idx" ON "crm_activities"("tenant_id", "business_id", "customer_id", "occurred_at");

-- CreateIndex
CREATE INDEX "crm_activities_tenant_id_business_id_opportunity_id_occurre_idx" ON "crm_activities"("tenant_id", "business_id", "opportunity_id", "occurred_at");

-- CreateIndex
CREATE INDEX "crm_activities_tenant_id_business_id_occurred_at_idx" ON "crm_activities"("tenant_id", "business_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "crm_activities_tenant_id_business_id_id_key" ON "crm_activities"("tenant_id", "business_id", "id");

-- AddForeignKey
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_tenant_id_business_id_fkey" FOREIGN KEY ("tenant_id", "business_id") REFERENCES "businesses"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_tenant_id_business_id_customer_id_fkey" FOREIGN KEY ("tenant_id", "business_id", "customer_id") REFERENCES "customers"("tenant_id", "business_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_tenant_id_business_id_opportunity_id_fkey" FOREIGN KEY ("tenant_id", "business_id", "opportunity_id") REFERENCES "opportunities"("tenant_id", "business_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_tenant_id_business_id_lead_id_fkey" FOREIGN KEY ("tenant_id", "business_id", "lead_id") REFERENCES "leads"("tenant_id", "business_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Row-level security: crm_activities is business-scoped, so it must fail closed
-- at the database like every other business-scoped table. DatabaseService.withScope
-- sets app.tenant_id/app.business_id before any query, giving the policy its context.
ALTER TABLE "crm_activities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crm_activities" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_business_isolation ON "crm_activities"
  USING (
    tenant_id = bizo_current_tenant_id()
    AND business_id = bizo_current_business_id()
  )
  WITH CHECK (
    tenant_id = bizo_current_tenant_id()
    AND business_id = bizo_current_business_id()
  );
