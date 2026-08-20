-- Sprint 6 · TASK-23: Signed webhook dispatcher & durable retry queue.
--
-- Evolves the placeholder webhook tables into the endpoint + delivery-queue model. All statements
-- are non-empty-table-safe: new NOT NULL columns are added with a default (or added with a
-- temporary default that is backfilled then dropped), and legacy columns are backfilled into their
-- successors before being dropped.

-- CreateEnum
CREATE TYPE "WebhookEndpointStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('PENDING', 'DELIVERING', 'DELIVERED', 'FAILED', 'DEAD');

-- AlterTable: webhook_subscriptions (endpoints) — add status, backfill from is_active, drop is_active.
ALTER TABLE "webhook_subscriptions" ADD COLUMN "status" "WebhookEndpointStatus" NOT NULL DEFAULT 'ACTIVE';
UPDATE "webhook_subscriptions" SET "status" = 'DISABLED' WHERE "is_active" = false;
ALTER TABLE "webhook_subscriptions" DROP COLUMN "is_active";

-- AlterTable: webhook_deliveries (retry queue) — add queue columns; updated_at gets a temporary
-- default so the NOT NULL add is safe on a non-empty table, then the default is dropped to match the
-- application-managed @updatedAt semantics.
ALTER TABLE "webhook_deliveries"
    ADD COLUMN "attempt_count" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "next_attempt_at" TIMESTAMPTZ(3),
    ADD COLUMN "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    ADD COLUMN "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ALTER COLUMN "status_code" DROP NOT NULL;

-- Backfill the new lifecycle from the legacy succeeded flag before dropping it.
UPDATE "webhook_deliveries"
SET "status" = CASE WHEN "succeeded" THEN 'DELIVERED'::"WebhookDeliveryStatus" ELSE 'FAILED'::"WebhookDeliveryStatus" END,
    "attempt_count" = 1,
    "updated_at" = "created_at";

ALTER TABLE "webhook_deliveries" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "webhook_deliveries" DROP COLUMN "succeeded";

-- CreateIndex
CREATE INDEX "webhook_deliveries_status_next_attempt_at_idx" ON "webhook_deliveries"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "webhook_subscriptions_tenant_id_business_id_status_idx" ON "webhook_subscriptions"("tenant_id", "business_id", "status");
