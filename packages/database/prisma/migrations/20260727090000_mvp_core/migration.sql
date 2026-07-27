-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "RoleCode" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('QUOTATION');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'SENT');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "display_name" VARCHAR(120) NOT NULL,
    "locale" VARCHAR(35) NOT NULL DEFAULT 'en',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "code" "RoleCode" NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "permissions" VARCHAR(80)[] DEFAULT ARRAY[]::VARCHAR(80)[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "businesses" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "legal_name" VARCHAR(200),
    "country_code" CHAR(2) NOT NULL,
    "base_currency" CHAR(3) NOT NULL,
    "currency_scale" SMALLINT NOT NULL DEFAULT 2,
    "locale" VARCHAR(35) NOT NULL DEFAULT 'en',
    "time_zone" VARCHAR(64) NOT NULL DEFAULT 'UTC',
    "email" VARCHAR(320),
    "phone" VARCHAR(40),
    "address_line_1" VARCHAR(200),
    "address_line_2" VARCHAR(200),
    "city" VARCHAR(120),
    "postal_code" VARCHAR(32),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "businesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_access" (
    "tenant_id" BIGINT NOT NULL,
    "business_id" BIGINT NOT NULL,
    "membership_id" BIGINT NOT NULL,
    "role_id" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_access_pkey" PRIMARY KEY ("tenant_id","business_id","membership_id")
);

-- CreateTable
CREATE TABLE "business_settings" (
    "business_id" BIGINT NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "quotation_prefix" VARCHAR(12) NOT NULL DEFAULT 'Q',
    "next_quotation_number" INTEGER NOT NULL DEFAULT 1,
    "quotation_validity_days" SMALLINT NOT NULL DEFAULT 30,
    "default_message" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "business_settings_pkey" PRIMARY KEY ("business_id")
);

-- CreateTable
CREATE TABLE "tax_profiles" (
    "business_id" BIGINT NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "name" VARCHAR(80) NOT NULL DEFAULT 'Tax',
    "registration_number" VARCHAR(80),
    "rate_ppm" INTEGER NOT NULL DEFAULT 0,
    "price_includes_tax" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tax_profiles_pkey" PRIMARY KEY ("business_id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "business_id" BIGINT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "email" VARCHAR(320),
    "phone" VARCHAR(40),
    "address_line_1" VARCHAR(200),
    "address_line_2" VARCHAR(200),
    "city" VARCHAR(120),
    "postal_code" VARCHAR(32),
    "country_code" CHAR(2),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "business_id" BIGINT NOT NULL,
    "customer_id" BIGINT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "number" VARCHAR(40) NOT NULL,
    "issue_date" DATE NOT NULL,
    "valid_until" DATE NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "currency_scale" SMALLINT NOT NULL,
    "subtotal_minor" DECIMAL(38,0) NOT NULL,
    "tax_minor" DECIMAL(38,0) NOT NULL,
    "total_minor" DECIMAL(38,0) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "sent_at" TIMESTAMPTZ(3),
    "created_by_membership_id" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_lines" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "business_id" BIGINT NOT NULL,
    "document_id" BIGINT NOT NULL,
    "position" INTEGER NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "quantity" DECIMAL(20,6) NOT NULL,
    "unit_price_minor" DECIMAL(38,0) NOT NULL,
    "tax_rate_ppm" INTEGER NOT NULL,
    "subtotal_minor" DECIMAL(38,0) NOT NULL,
    "tax_minor" DECIMAL(38,0) NOT NULL,
    "total_minor" DECIMAL(38,0) NOT NULL,

    CONSTRAINT "document_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_versions" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "business_id" BIGINT NOT NULL,
    "document_id" BIGINT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "template_name" VARCHAR(80) NOT NULL DEFAULT 'professional-v1',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_deliveries" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "business_id" BIGINT NOT NULL,
    "document_id" BIGINT NOT NULL,
    "document_version" INTEGER NOT NULL,
    "recipient_email" VARCHAR(320) NOT NULL,
    "message" VARCHAR(2000),
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "provider_message_id" VARCHAR(255),
    "failure_reason" VARCHAR(500),
    "sent_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "document_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "business_id" BIGINT NOT NULL,
    "actor_user_id" BIGINT NOT NULL,
    "action" VARCHAR(80) NOT NULL,
    "target_type" VARCHAR(80) NOT NULL,
    "target_public_id" UUID NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "request_id" VARCHAR(128) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "business_id" BIGINT NOT NULL,
    "event_type" VARCHAR(120) NOT NULL,
    "aggregate_type" VARCHAR(80) NOT NULL,
    "aggregate_public_id" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "available_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_public_id_key" ON "users"("public_id");

-- CreateIndex
CREATE INDEX "users_public_id_idx" ON "users"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_public_id_key" ON "tenants"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_public_id_key" ON "memberships"("public_id");

-- CreateIndex
CREATE INDEX "memberships_user_id_status_idx" ON "memberships"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_tenant_id_user_id_key" ON "memberships"("tenant_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_tenant_id_id_key" ON "memberships"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_public_id_key" ON "roles"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_tenant_id_code_key" ON "roles"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "roles_tenant_id_id_key" ON "roles"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "businesses_public_id_key" ON "businesses"("public_id");

-- CreateIndex
CREATE INDEX "businesses_tenant_id_name_idx" ON "businesses"("tenant_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "businesses_tenant_id_id_key" ON "businesses"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "business_access_tenant_id_membership_id_idx" ON "business_access"("tenant_id", "membership_id");

-- CreateIndex
CREATE INDEX "business_access_tenant_id_role_id_idx" ON "business_access"("tenant_id", "role_id");

-- CreateIndex
CREATE UNIQUE INDEX "business_settings_tenant_id_business_id_key" ON "business_settings"("tenant_id", "business_id");

-- CreateIndex
CREATE UNIQUE INDEX "tax_profiles_tenant_id_business_id_key" ON "tax_profiles"("tenant_id", "business_id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_public_id_key" ON "customers"("public_id");

-- CreateIndex
CREATE INDEX "customers_tenant_id_business_id_name_idx" ON "customers"("tenant_id", "business_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "customers_tenant_id_business_id_id_key" ON "customers"("tenant_id", "business_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "documents_public_id_key" ON "documents"("public_id");

-- CreateIndex
CREATE INDEX "documents_tenant_id_business_id_status_created_at_idx" ON "documents"("tenant_id", "business_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "documents_tenant_id_business_id_id_key" ON "documents"("tenant_id", "business_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "documents_tenant_id_business_id_type_number_key" ON "documents"("tenant_id", "business_id", "type", "number");

-- CreateIndex
CREATE INDEX "document_lines_tenant_id_business_id_document_id_idx" ON "document_lines"("tenant_id", "business_id", "document_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_lines_tenant_id_business_id_document_id_position_key" ON "document_lines"("tenant_id", "business_id", "document_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_public_id_key" ON "document_versions"("public_id");

-- CreateIndex
CREATE INDEX "document_versions_tenant_id_business_id_document_id_idx" ON "document_versions"("tenant_id", "business_id", "document_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_tenant_id_business_id_document_id_version_key" ON "document_versions"("tenant_id", "business_id", "document_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "document_deliveries_public_id_key" ON "document_deliveries"("public_id");

-- CreateIndex
CREATE INDEX "document_deliveries_tenant_id_business_id_document_id_creat_idx" ON "document_deliveries"("tenant_id", "business_id", "document_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "audit_events_public_id_key" ON "audit_events"("public_id");

-- CreateIndex
CREATE INDEX "audit_events_tenant_id_business_id_target_type_target_publi_idx" ON "audit_events"("tenant_id", "business_id", "target_type", "target_public_id", "created_at");

-- CreateIndex
CREATE INDEX "outbox_events_published_at_available_at_idx" ON "outbox_events"("published_at", "available_at");

-- CreateIndex
CREATE INDEX "outbox_events_tenant_id_business_id_created_at_idx" ON "outbox_events"("tenant_id", "business_id", "created_at");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_access" ADD CONSTRAINT "business_access_tenant_id_business_id_fkey" FOREIGN KEY ("tenant_id", "business_id") REFERENCES "businesses"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_access" ADD CONSTRAINT "business_access_tenant_id_membership_id_fkey" FOREIGN KEY ("tenant_id", "membership_id") REFERENCES "memberships"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_access" ADD CONSTRAINT "business_access_tenant_id_role_id_fkey" FOREIGN KEY ("tenant_id", "role_id") REFERENCES "roles"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_tenant_id_business_id_fkey" FOREIGN KEY ("tenant_id", "business_id") REFERENCES "businesses"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_profiles" ADD CONSTRAINT "tax_profiles_tenant_id_business_id_fkey" FOREIGN KEY ("tenant_id", "business_id") REFERENCES "businesses"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_business_id_fkey" FOREIGN KEY ("tenant_id", "business_id") REFERENCES "businesses"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_id_business_id_fkey" FOREIGN KEY ("tenant_id", "business_id") REFERENCES "businesses"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_id_business_id_customer_id_fkey" FOREIGN KEY ("tenant_id", "business_id", "customer_id") REFERENCES "customers"("tenant_id", "business_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_id_created_by_membership_id_fkey" FOREIGN KEY ("tenant_id", "created_by_membership_id") REFERENCES "memberships"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_lines" ADD CONSTRAINT "document_lines_tenant_id_business_id_document_id_fkey" FOREIGN KEY ("tenant_id", "business_id", "document_id") REFERENCES "documents"("tenant_id", "business_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_tenant_id_business_id_document_id_fkey" FOREIGN KEY ("tenant_id", "business_id", "document_id") REFERENCES "documents"("tenant_id", "business_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_deliveries" ADD CONSTRAINT "document_deliveries_tenant_id_business_id_document_id_document_version_fkey" FOREIGN KEY ("tenant_id", "business_id", "document_id", "document_version") REFERENCES "document_versions"("tenant_id", "business_id", "document_id", "version") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_tenant_id_business_id_fkey" FOREIGN KEY ("tenant_id", "business_id") REFERENCES "businesses"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_tenant_id_business_id_fkey" FOREIGN KEY ("tenant_id", "business_id") REFERENCES "businesses"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Normalize identity keys at the database boundary.
CREATE UNIQUE INDEX "users_email_casefold_key" ON "users" (lower("email"));

ALTER TABLE "users"
  ADD CONSTRAINT "users_email_normalized_check"
    CHECK ("email" = lower(btrim("email"))),
  ADD CONSTRAINT "users_display_name_present_check"
    CHECK (length(btrim("display_name")) > 0);

-- Preserve exact country, currency, numbering, tax, and money invariants.
ALTER TABLE "businesses"
  ADD CONSTRAINT "businesses_country_code_check"
    CHECK ("country_code" ~ '^[A-Z]{2}$'),
  ADD CONSTRAINT "businesses_base_currency_check"
    CHECK ("base_currency" ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT "businesses_currency_scale_check"
    CHECK ("currency_scale" BETWEEN 0 AND 4),
  ADD CONSTRAINT "businesses_name_present_check"
    CHECK (length(btrim("name")) > 0);

ALTER TABLE "business_settings"
  ADD CONSTRAINT "business_settings_quotation_prefix_check"
    CHECK ("quotation_prefix" ~ '^[A-Z0-9-]{1,12}$'),
  ADD CONSTRAINT "business_settings_next_number_check"
    CHECK ("next_quotation_number" > 0),
  ADD CONSTRAINT "business_settings_validity_days_check"
    CHECK ("quotation_validity_days" BETWEEN 1 AND 365);

ALTER TABLE "tax_profiles"
  ADD CONSTRAINT "tax_profiles_rate_ppm_check"
    CHECK ("rate_ppm" BETWEEN 0 AND 1000000);

ALTER TABLE "customers"
  ADD CONSTRAINT "customers_name_present_check"
    CHECK (length(btrim("name")) > 0),
  ADD CONSTRAINT "customers_country_code_check"
    CHECK ("country_code" IS NULL OR "country_code" ~ '^[A-Z]{2}$');

ALTER TABLE "documents"
  ADD CONSTRAINT "documents_currency_code_check"
    CHECK ("currency_code" ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT "documents_currency_scale_check"
    CHECK ("currency_scale" BETWEEN 0 AND 4),
  ADD CONSTRAINT "documents_dates_check"
    CHECK ("valid_until" >= "issue_date"),
  ADD CONSTRAINT "documents_version_check"
    CHECK ("version" > 0),
  ADD CONSTRAINT "documents_amounts_check"
    CHECK (
      "subtotal_minor" >= 0
      AND "tax_minor" >= 0
      AND "total_minor" = "subtotal_minor" + "tax_minor"
    );

ALTER TABLE "document_lines"
  ADD CONSTRAINT "document_lines_position_check"
    CHECK ("position" > 0),
  ADD CONSTRAINT "document_lines_description_present_check"
    CHECK (length(btrim("description")) > 0),
  ADD CONSTRAINT "document_lines_quantity_check"
    CHECK ("quantity" > 0),
  ADD CONSTRAINT "document_lines_tax_rate_check"
    CHECK ("tax_rate_ppm" BETWEEN 0 AND 1000000),
  ADD CONSTRAINT "document_lines_amounts_check"
    CHECK (
      "unit_price_minor" >= 0
      AND "subtotal_minor" >= 0
      AND "tax_minor" >= 0
      AND "total_minor" = "subtotal_minor" + "tax_minor"
    );

-- Business data is visible only inside a transaction carrying trusted scope.
CREATE FUNCTION "bizo_current_tenant_id"()
RETURNS BIGINT
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::BIGINT
$$;

CREATE FUNCTION "bizo_current_business_id"()
RETURNS BIGINT
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.business_id', true), '')::BIGINT
$$;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'business_settings',
    'tax_profiles',
    'customers',
    'documents',
    'document_lines',
    'document_versions',
    'document_deliveries',
    'audit_events',
    'outbox_events'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_business_isolation ON %I
       USING (
         tenant_id = bizo_current_tenant_id()
         AND business_id = bizo_current_business_id()
       )
       WITH CHECK (
         tenant_id = bizo_current_tenant_id()
         AND business_id = bizo_current_business_id()
       )',
      table_name
    );
  END LOOP;
END
$$;
