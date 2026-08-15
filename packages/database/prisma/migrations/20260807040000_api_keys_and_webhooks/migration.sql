-- Phase 3: API Keys and Webhooks

-- Create api_keys table
CREATE TABLE IF NOT EXISTS "api_keys" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "business_id" BIGINT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "secret_hash" VARCHAR(255) NOT NULL,
    "scopes" VARCHAR(80)[] NOT NULL DEFAULT '{}',
    "last_used_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "api_keys_public_id_key" ON "api_keys"("public_id");
CREATE UNIQUE INDEX IF NOT EXISTS "api_keys_tenant_id_business_id_id_key" ON "api_keys"("tenant_id", "business_id", "id");
CREATE INDEX IF NOT EXISTS "api_keys_public_id_idx" ON "api_keys"("public_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'api_keys_tenant_id_business_id_fkey') THEN
    ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_tenant_id_business_id_fkey" FOREIGN KEY ("tenant_id", "business_id") REFERENCES "businesses"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Create webhook_subscriptions table
CREATE TABLE IF NOT EXISTS "webhook_subscriptions" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "business_id" BIGINT NOT NULL,
    "url" VARCHAR(512) NOT NULL,
    "events" VARCHAR(120)[] NOT NULL DEFAULT '{}',
    "secret_hash" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "webhook_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "webhook_subscriptions_public_id_key" ON "webhook_subscriptions"("public_id");
CREATE UNIQUE INDEX IF NOT EXISTS "webhook_subscriptions_tenant_id_business_id_id_key" ON "webhook_subscriptions"("tenant_id", "business_id", "id");
CREATE INDEX IF NOT EXISTS "webhook_subscriptions_public_id_idx" ON "webhook_subscriptions"("public_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'webhook_subscriptions_tenant_id_business_id_fkey') THEN
    ALTER TABLE "webhook_subscriptions" ADD CONSTRAINT "webhook_subscriptions_tenant_id_business_id_fkey" FOREIGN KEY ("tenant_id", "business_id") REFERENCES "businesses"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Create webhook_deliveries table
CREATE TABLE IF NOT EXISTS "webhook_deliveries" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "webhook_subscription_id" BIGINT NOT NULL,
    "event_type" VARCHAR(120) NOT NULL,
    "payload" JSONB NOT NULL,
    "status_code" INTEGER NOT NULL,
    "succeeded" BOOLEAN NOT NULL,
    "error_message" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "webhook_deliveries_public_id_key" ON "webhook_deliveries"("public_id");
CREATE INDEX IF NOT EXISTS "webhook_deliveries_webhook_subscription_id_created_at_idx" ON "webhook_deliveries"("webhook_subscription_id", "created_at");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'webhook_deliveries_webhook_subscription_id_fkey') THEN
    ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_subscription_id_fkey" FOREIGN KEY ("webhook_subscription_id") REFERENCES "webhook_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
