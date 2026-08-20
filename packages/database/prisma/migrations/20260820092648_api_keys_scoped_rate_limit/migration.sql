/*
  Warnings:

  - Added the required column `prefix` to the `api_keys` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ApiKeyStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- AlterTable
ALTER TABLE "api_keys" ADD COLUMN     "prefix" VARCHAR(24) NOT NULL,
ADD COLUMN     "status" "ApiKeyStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE INDEX "api_keys_prefix_idx" ON "api_keys"("prefix");
