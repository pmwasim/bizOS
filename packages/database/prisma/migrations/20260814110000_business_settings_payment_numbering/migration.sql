-- Payment numbering columns for business_settings.
--
-- schema.prisma has declared BusinessSettings.paymentPrefix and .nextPaymentNumber for some time,
-- but the only migration that created them (20260728030000_customer_payment_allocation) was never
-- actually applied to production, so the columns are absent there. Prisma selects every declared
-- scalar explicitly, so a client generated from the current schema errors on any read of
-- business_settings against the deployed database.
--
-- IF NOT EXISTS keeps this safe on databases that did receive the original migration.

ALTER TABLE "business_settings"
  ADD COLUMN IF NOT EXISTS "payment_prefix" VARCHAR(12) NOT NULL DEFAULT 'PAY',
  ADD COLUMN IF NOT EXISTS "next_payment_number" INTEGER NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'business_settings_payment_prefix_check'
  ) THEN
    ALTER TABLE "business_settings"
      ADD CONSTRAINT "business_settings_payment_prefix_check"
      CHECK (char_length("payment_prefix") BETWEEN 1 AND 12);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'business_settings_next_payment_number_check'
  ) THEN
    ALTER TABLE "business_settings"
      ADD CONSTRAINT "business_settings_next_payment_number_check"
      CHECK ("next_payment_number" >= 1);
  END IF;
END $$;
