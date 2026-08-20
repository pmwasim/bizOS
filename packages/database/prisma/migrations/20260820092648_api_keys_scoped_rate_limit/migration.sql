-- CreateEnum
CREATE TYPE "ApiKeyStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- AlterTable: add the new columns. `status` carries a default so existing rows are valid immediately.
-- `prefix` is added nullable first so the constraint can be enforced only after a backfill; this keeps
-- the migration safe to apply to a table that already holds rows (e.g. keys minted before this change).
ALTER TABLE "api_keys" ADD COLUMN     "prefix" VARCHAR(24),
ADD COLUMN     "status" "ApiKeyStatus" NOT NULL DEFAULT 'ACTIVE';

-- Backfill any legacy rows: keys created before this change were stored under the previous secret
-- scheme and cannot be verified under the new hashing/prefix format, so they are invalidated (REVOKED)
-- and given a deterministic, non-secret placeholder prefix derived from their id.
UPDATE "api_keys"
SET "prefix" = 'legacy_' || left("id"::text, 8),
    "status" = 'REVOKED'
WHERE "prefix" IS NULL;

-- Now that every row has a value, enforce the NOT NULL constraint.
ALTER TABLE "api_keys" ALTER COLUMN "prefix" SET NOT NULL;

-- CreateIndex
CREATE INDEX "api_keys_prefix_idx" ON "api_keys"("prefix");
