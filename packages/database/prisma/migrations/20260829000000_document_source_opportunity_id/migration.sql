-- Track the opportunity a quotation was converted from, so a retried conversion
-- can recover a committed-but-unlinked quotation instead of creating a duplicate.
-- Nullable column: safe to add to a non-empty table.
ALTER TABLE "documents" ADD COLUMN "source_opportunity_id" BIGINT;

-- At most one quotation per opportunity. Partial (WHERE NOT NULL) so the many
-- existing documents with a NULL source_opportunity_id are unaffected. Prisma
-- cannot express a partial unique index, so it is created here in raw SQL.
CREATE UNIQUE INDEX "documents_source_opportunity_id_key"
  ON "documents" ("source_opportunity_id")
  WHERE "source_opportunity_id" IS NOT NULL;
