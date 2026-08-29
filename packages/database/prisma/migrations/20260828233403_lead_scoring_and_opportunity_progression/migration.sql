-- Lead scoring: add a deterministic 0-100 score column to leads.
-- NOT NULL with DEFAULT 0 so the column is safe to add to a non-empty table
-- (existing rows adopt the default; the application recomputes on next write).
ALTER TABLE "leads" ADD COLUMN "score" SMALLINT NOT NULL DEFAULT 0;
