-- Zero-padding width for document numbering on business_settings.
--
-- The sequence part of every document number (e.g. the 0001 in INV-0001) is left-padded to this
-- width. It is configurable per business; number allocation stays gap-safe and race-safe regardless
-- of the width. IF NOT EXISTS keeps this safe to re-run.

ALTER TABLE "business_settings"
  ADD COLUMN IF NOT EXISTS "number_pad_width" SMALLINT NOT NULL DEFAULT 4;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'business_settings_number_pad_width_check'
  ) THEN
    ALTER TABLE "business_settings"
      ADD CONSTRAINT "business_settings_number_pad_width_check"
      CHECK ("number_pad_width" BETWEEN 1 AND 12);
  END IF;
END $$;
