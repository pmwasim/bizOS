-- Phase 5: Products/Services catalogue

CREATE TABLE "products" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "business_id" BIGINT NOT NULL,
    "sku" VARCHAR(60) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" VARCHAR(500),
    "type" VARCHAR(20) NOT NULL DEFAULT 'PRODUCT',
    "unit" VARCHAR(20),
    "cost_price_minor" DECIMAL(38,0),
    "selling_price_minor" DECIMAL(38,0),
    "tax_rate_ppm" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "products_public_id_key" ON "products"("public_id");
CREATE UNIQUE INDEX "products_tenant_id_business_id_id_key" ON "products"("tenant_id", "business_id", "id");
CREATE UNIQUE INDEX "products_tenant_id_business_id_sku_key" ON "products"("tenant_id", "business_id", "sku");
CREATE INDEX "products_tenant_id_business_id_name_idx" ON "products"("tenant_id", "business_id", "name");

ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_business_id_fkey" FOREIGN KEY ("tenant_id", "business_id") REFERENCES "businesses"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
