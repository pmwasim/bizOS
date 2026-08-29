-- Multi-location inventory: stock locations + an append-only stock movement
-- ledger. Additive only (Prisma also proposed dropping/recreating unrelated,
-- unchanged foreign keys on opportunities/projects; that no-op churn is removed).

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('RECEIPT', 'DISPATCH', 'TRANSFER', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "stock_locations" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "business_id" BIGINT NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "stock_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "business_id" BIGINT NOT NULL,
    "item_id" BIGINT NOT NULL,
    "location_id" BIGINT NOT NULL,
    "movement_type" "StockMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_cost_minor" DECIMAL(38,0) NOT NULL DEFAULT 0,
    "reference_type" VARCHAR(20),
    "reference_id" VARCHAR(64),
    "request_id" VARCHAR(64),
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stock_locations_public_id_key" ON "stock_locations"("public_id");
CREATE INDEX "stock_locations_tenant_id_business_id_is_active_idx" ON "stock_locations"("tenant_id", "business_id", "is_active");
CREATE UNIQUE INDEX "stock_locations_tenant_id_business_id_id_key" ON "stock_locations"("tenant_id", "business_id", "id");
CREATE UNIQUE INDEX "stock_locations_tenant_id_business_id_code_key" ON "stock_locations"("tenant_id", "business_id", "code");
CREATE UNIQUE INDEX "stock_movements_public_id_key" ON "stock_movements"("public_id");
CREATE INDEX "stock_movements_tenant_id_business_id_item_id_location_id_o_idx" ON "stock_movements"("tenant_id", "business_id", "item_id", "location_id", "occurred_at");
CREATE INDEX "stock_movements_tenant_id_business_id_location_id_occurred__idx" ON "stock_movements"("tenant_id", "business_id", "location_id", "occurred_at");
CREATE UNIQUE INDEX "stock_movements_tenant_id_business_id_id_key" ON "stock_movements"("tenant_id", "business_id", "id");
CREATE UNIQUE INDEX "stock_movements_business_id_request_id_location_id_key" ON "stock_movements"("business_id", "request_id", "location_id") WHERE "request_id" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "stock_locations" ADD CONSTRAINT "stock_locations_tenant_id_business_id_fkey" FOREIGN KEY ("tenant_id", "business_id") REFERENCES "businesses"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_tenant_id_business_id_fkey" FOREIGN KEY ("tenant_id", "business_id") REFERENCES "businesses"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_tenant_id_business_id_item_id_fkey" FOREIGN KEY ("tenant_id", "business_id", "item_id") REFERENCES "inventory_items"("tenant_id", "business_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_tenant_id_business_id_location_id_fkey" FOREIGN KEY ("tenant_id", "business_id", "location_id") REFERENCES "stock_locations"("tenant_id", "business_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Row-level security: both tables are business-scoped, so they must fail closed
-- at the database like every peer table. DatabaseService.withScope sets the
-- app.tenant_id/app.business_id GUCs the policy reads.
ALTER TABLE "stock_locations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_locations" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_business_isolation ON "stock_locations"
  USING (tenant_id = bizo_current_tenant_id() AND business_id = bizo_current_business_id())
  WITH CHECK (tenant_id = bizo_current_tenant_id() AND business_id = bizo_current_business_id());

ALTER TABLE "stock_movements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_movements" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_business_isolation ON "stock_movements"
  USING (tenant_id = bizo_current_tenant_id() AND business_id = bizo_current_business_id())
  WITH CHECK (tenant_id = bizo_current_tenant_id() AND business_id = bizo_current_business_id());
