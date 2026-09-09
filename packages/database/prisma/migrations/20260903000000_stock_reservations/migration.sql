-- Persisted stock holds for confirmed sales orders and ready invoices.

CREATE TYPE "StockReservationStatus" AS ENUM ('RESERVED', 'RELEASED', 'FULFILLED');

ALTER TABLE "document_lines" ADD COLUMN "inventory_item_id" BIGINT;
CREATE INDEX "document_lines_tenant_id_business_id_inventory_item_id_idx"
  ON "document_lines"("tenant_id", "business_id", "inventory_item_id");
ALTER TABLE "document_lines"
  ADD CONSTRAINT "document_lines_tenant_id_business_id_inventory_item_id_fkey"
  FOREIGN KEY ("tenant_id", "business_id", "inventory_item_id")
  REFERENCES "inventory_items"("tenant_id", "business_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "stock_reservations" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "business_id" BIGINT NOT NULL,
    "document_id" BIGINT NOT NULL,
    "item_id" BIGINT NOT NULL,
    "location_id" BIGINT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "StockReservationStatus" NOT NULL DEFAULT 'RESERVED',
    "released_at" TIMESTAMPTZ(3),
    "fulfilled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_reservations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "stock_reservations_quantity_check" CHECK ("quantity" > 0)
);

CREATE UNIQUE INDEX "stock_reservations_public_id_key" ON "stock_reservations"("public_id");
CREATE UNIQUE INDEX "stock_reservations_tenant_id_business_id_id_key"
  ON "stock_reservations"("tenant_id", "business_id", "id");
CREATE UNIQUE INDEX "stock_reservations_active_document_item_location_key"
  ON "stock_reservations"("business_id", "document_id", "item_id", "location_id")
  WHERE "status" = 'RESERVED';
CREATE INDEX "stock_reservations_document_status_idx"
  ON "stock_reservations"("tenant_id", "business_id", "document_id", "status");
CREATE INDEX "stock_reservations_item_location_status_idx"
  ON "stock_reservations"("tenant_id", "business_id", "item_id", "location_id", "status");

ALTER TABLE "stock_reservations"
  ADD CONSTRAINT "stock_reservations_tenant_business_fkey"
  FOREIGN KEY ("tenant_id", "business_id") REFERENCES "businesses"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_reservations"
  ADD CONSTRAINT "stock_reservations_document_fkey"
  FOREIGN KEY ("tenant_id", "business_id", "document_id") REFERENCES "documents"("tenant_id", "business_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_reservations"
  ADD CONSTRAINT "stock_reservations_item_fkey"
  FOREIGN KEY ("tenant_id", "business_id", "item_id") REFERENCES "inventory_items"("tenant_id", "business_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_reservations"
  ADD CONSTRAINT "stock_reservations_location_fkey"
  FOREIGN KEY ("tenant_id", "business_id", "location_id") REFERENCES "stock_locations"("tenant_id", "business_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stock_reservations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_reservations" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_business_isolation ON "stock_reservations"
  USING (tenant_id = bizo_current_tenant_id() AND business_id = bizo_current_business_id())
  WITH CHECK (tenant_id = bizo_current_tenant_id() AND business_id = bizo_current_business_id());
