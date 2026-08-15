-- Phase 1/2/3/4/5 migration: Sales Orders, Procurement, CRM, Projects, Inventory, API Keys, Webhooks
-- Generated manually for bizOS schema extensions.

-- Add new DocumentType enum values
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'SALES_ORDER';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'DELIVERY_NOTE';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'SERVICE_COMPLETION';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'SUPPLIER_QUOTATION';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'SUPPLIER_PURCHASE_ORDER';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'SUPPLIER_BILL';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'GOODS_RECEIPT_NOTE';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'CREDIT_NOTE';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'DEBIT_NOTE';

-- Add new StoredObjectKind enum values
ALTER TYPE "StoredObjectKind" ADD VALUE IF NOT EXISTS 'SUPPLIER_PO';
ALTER TYPE "StoredObjectKind" ADD VALUE IF NOT EXISTS 'SUPPLIER_BILL';
ALTER TYPE "StoredObjectKind" ADD VALUE IF NOT EXISTS 'GOODS_RECEIPT';
ALTER TYPE "StoredObjectKind" ADD VALUE IF NOT EXISTS 'PROJECT_EVIDENCE';

-- Extend business_settings table with new numbering sequences
ALTER TABLE "business_settings" ADD COLUMN IF NOT EXISTS "sales_order_prefix" VARCHAR(12) NOT NULL DEFAULT 'SO';
ALTER TABLE "business_settings" ADD COLUMN IF NOT EXISTS "next_sales_order_number" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "business_settings" ADD COLUMN IF NOT EXISTS "delivery_note_prefix" VARCHAR(12) NOT NULL DEFAULT 'DN';
ALTER TABLE "business_settings" ADD COLUMN IF NOT EXISTS "next_delivery_note_number" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "business_settings" ADD COLUMN IF NOT EXISTS "credit_note_prefix" VARCHAR(12) NOT NULL DEFAULT 'CN';
ALTER TABLE "business_settings" ADD COLUMN IF NOT EXISTS "next_credit_note_number" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "business_settings" ADD COLUMN IF NOT EXISTS "purchase_order_prefix" VARCHAR(12) NOT NULL DEFAULT 'PO';
ALTER TABLE "business_settings" ADD COLUMN IF NOT EXISTS "next_purchase_order_number" INTEGER NOT NULL DEFAULT 1;

-- Extend documents table with new fields
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "supplier_id" BIGINT;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "source_document_id" BIGINT;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "reference_document_id" BIGINT;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "delivery_date" DATE;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "received_at" TIMESTAMPTZ(3);

-- Extend purchase_orders table with supplier reference
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "supplier_id" BIGINT;

-- Create suppliers table
CREATE TABLE IF NOT EXISTS "suppliers" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "business_id" BIGINT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "contact_name" VARCHAR(120),
    "email" VARCHAR(320),
    "phone" VARCHAR(40),
    "address_line_1" VARCHAR(200),
    "address_line_2" VARCHAR(200),
    "city" VARCHAR(120),
    "postal_code" VARCHAR(32),
    "country_code" CHAR(2),
    "tax_id" VARCHAR(80),
    "tax_name" VARCHAR(80),
    "bank_name" VARCHAR(120),
    "iban" VARCHAR(34),
    "swift_code" VARCHAR(11),
    "payment_terms" SMALLINT,
    "notes" VARCHAR(2000),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "suppliers_public_id_key" ON "suppliers"("public_id");
CREATE UNIQUE INDEX IF NOT EXISTS "suppliers_tenant_id_business_id_id_key" ON "suppliers"("tenant_id", "business_id", "id");
CREATE INDEX IF NOT EXISTS "suppliers_tenant_id_business_id_name_idx" ON "suppliers"("tenant_id", "business_id", "name");
CREATE INDEX IF NOT EXISTS "suppliers_tenant_id_business_id_tax_id_idx" ON "suppliers"("tenant_id", "business_id", "tax_id");

ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_tenant_id_business_id_fkey" FOREIGN KEY ("tenant_id", "business_id") REFERENCES "businesses"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Create credit_note_allocations table
CREATE TABLE IF NOT EXISTS "credit_note_allocations" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "business_id" BIGINT NOT NULL,
    "credit_note_id" BIGINT NOT NULL,
    "invoice_id" BIGINT NOT NULL,
    "amount_minor" DECIMAL(38,0) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_note_allocations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "credit_note_allocations_public_id_key" ON "credit_note_allocations"("public_id");
CREATE UNIQUE INDEX IF NOT EXISTS "credit_note_allocations_tenant_id_business_id_id_key" ON "credit_note_allocations"("tenant_id", "business_id", "id");
CREATE INDEX IF NOT EXISTS "credit_note_allocations_tenant_id_business_id_credit_note_id_idx" ON "credit_note_allocations"("tenant_id", "business_id", "credit_note_id");
CREATE INDEX IF NOT EXISTS "credit_note_allocations_tenant_id_business_id_invoice_id_idx" ON "credit_note_allocations"("tenant_id", "business_id", "invoice_id");

ALTER TABLE "credit_note_allocations" ADD CONSTRAINT "credit_note_allocations_tenant_id_business_id_fkey" FOREIGN KEY ("tenant_id", "business_id") REFERENCES "businesses"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "credit_note_allocations" ADD CONSTRAINT "credit_note_allocations_tenant_id_business_id_credit_note_id_fkey" FOREIGN KEY ("tenant_id", "business_id", "credit_note_id") REFERENCES "documents"("tenant_id", "business_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "credit_note_allocations" ADD CONSTRAINT "credit_note_allocations_tenant_id_business_id_invoice_id_fkey" FOREIGN KEY ("tenant_id", "business_id", "invoice_id") REFERENCES "documents"("tenant_id", "business_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Create leads table
CREATE TABLE IF NOT EXISTS "leads" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "business_id" BIGINT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "company" VARCHAR(200),
    "email" VARCHAR(320),
    "phone" VARCHAR(40),
    "source" VARCHAR(80),
    "status" VARCHAR(40) NOT NULL DEFAULT 'NEW',
    "estimated_value" DECIMAL(38,0),
    "currency_code" CHAR(3),
    "notes" VARCHAR(2000),
    "assigned_to_membership_id" BIGINT,
    "converted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "leads_public_id_key" ON "leads"("public_id");
CREATE UNIQUE INDEX IF NOT EXISTS "leads_tenant_id_business_id_id_key" ON "leads"("tenant_id", "business_id", "id");
CREATE INDEX IF NOT EXISTS "leads_tenant_id_business_id_status_idx" ON "leads"("tenant_id", "business_id", "status");

ALTER TABLE "leads" ADD CONSTRAINT "leads_tenant_id_business_id_fkey" FOREIGN KEY ("tenant_id", "business_id") REFERENCES "businesses"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Create opportunities table
CREATE TABLE IF NOT EXISTS "opportunities" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "business_id" BIGINT NOT NULL,
    "lead_id" BIGINT,
    "quotation_id" BIGINT,
    "name" VARCHAR(200) NOT NULL,
    "stage" VARCHAR(40) NOT NULL DEFAULT 'PROSPECTING',
    "probability" SMALLINT,
    "amount_minor" DECIMAL(38,0),
    "currency_code" CHAR(3),
    "expected_close_date" DATE,
    "actual_close_date" DATE,
    "notes" VARCHAR(2000),
    "assigned_to_membership_id" BIGINT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "opportunities_public_id_key" ON "opportunities"("public_id");
CREATE UNIQUE INDEX IF NOT EXISTS "opportunities_tenant_id_business_id_id_key" ON "opportunities"("tenant_id", "business_id", "id");
CREATE INDEX IF NOT EXISTS "opportunities_tenant_id_business_id_stage_idx" ON "opportunities"("tenant_id", "business_id", "stage");

ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_tenant_id_business_id_fkey" FOREIGN KEY ("tenant_id", "business_id") REFERENCES "businesses"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_tenant_id_business_id_lead_id_fkey" FOREIGN KEY ("tenant_id", "business_id", "lead_id") REFERENCES "leads"("tenant_id", "business_id", "id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_tenant_id_business_id_quotation_id_fkey" FOREIGN KEY ("tenant_id", "business_id", "quotation_id") REFERENCES "documents"("tenant_id", "business_id", "id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create projects table
CREATE TABLE IF NOT EXISTS "projects" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "business_id" BIGINT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" VARCHAR(2000),
    "status" VARCHAR(40) NOT NULL DEFAULT 'ACTIVE',
    "start_date" DATE,
    "end_date" DATE,
    "budget_minor" DECIMAL(38,0),
    "currency_code" CHAR(3),
    "customer_id" BIGINT,
    "notes" VARCHAR(2000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "projects_public_id_key" ON "projects"("public_id");
CREATE UNIQUE INDEX IF NOT EXISTS "projects_tenant_id_business_id_id_key" ON "projects"("tenant_id", "business_id", "id");
CREATE INDEX IF NOT EXISTS "projects_tenant_id_business_id_status_idx" ON "projects"("tenant_id", "business_id", "status");

ALTER TABLE "projects" ADD CONSTRAINT "projects_tenant_id_business_id_fkey" FOREIGN KEY ("tenant_id", "business_id") REFERENCES "businesses"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_tenant_id_business_id_customer_id_fkey" FOREIGN KEY ("tenant_id", "business_id", "customer_id") REFERENCES "customers"("tenant_id", "business_id", "id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create inventory_items table
CREATE TABLE IF NOT EXISTS "inventory_items" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "business_id" BIGINT NOT NULL,
    "sku" VARCHAR(60) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" VARCHAR(500),
    "item_type" VARCHAR(20) NOT NULL DEFAULT 'INVENTORY',
    "unit" VARCHAR(20),
    "cost_price_minor" DECIMAL(38,0),
    "selling_price_minor" DECIMAL(38,0),
    "rate_ppm" INTEGER NOT NULL DEFAULT 0,
    "reorder_level" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "inventory_items_public_id_key" ON "inventory_items"("public_id");
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_items_tenant_id_business_id_id_key" ON "inventory_items"("tenant_id", "business_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_items_tenant_id_business_id_sku_key" ON "inventory_items"("tenant_id", "business_id", "sku");
CREATE INDEX IF NOT EXISTS "inventory_items_tenant_id_business_id_name_idx" ON "inventory_items"("tenant_id", "business_id", "name");

ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_tenant_id_business_id_fkey" FOREIGN KEY ("tenant_id", "business_id") REFERENCES "businesses"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Create api_keys table (Phase 3: Public API)
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

ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_tenant_id_business_id_fkey" FOREIGN KEY ("tenant_id", "business_id") REFERENCES "businesses"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create webhook_subscriptions table (Phase 3: Webhooks)
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

ALTER TABLE "webhook_subscriptions" ADD CONSTRAINT "webhook_subscriptions_tenant_id_business_id_fkey" FOREIGN KEY ("tenant_id", "business_id") REFERENCES "businesses"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

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

ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_subscription_id_fkey" FOREIGN KEY ("webhook_subscription_id") REFERENCES "webhook_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add foreign keys for new document relations
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_id_business_id_supplier_id_fkey" FOREIGN KEY ("tenant_id", "business_id", "supplier_id") REFERENCES "suppliers"("tenant_id", "business_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_id_business_id_source_document_id_fkey" FOREIGN KEY ("tenant_id", "business_id", "source_document_id") REFERENCES "documents"("tenant_id", "business_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_id_business_id_reference_document_id_fkey" FOREIGN KEY ("tenant_id", "business_id", "reference_document_id") REFERENCES "documents"("tenant_id", "business_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add foreign key for purchase_orders supplier
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_tenant_id_business_id_supplier_id_fkey" FOREIGN KEY ("tenant_id", "business_id", "supplier_id") REFERENCES "suppliers"("tenant_id", "business_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add indexes for new document relations
CREATE INDEX IF NOT EXISTS "documents_tenant_id_business_id_supplier_id_idx" ON "documents"("tenant_id", "business_id", "supplier_id");
CREATE INDEX IF NOT EXISTS "documents_tenant_id_business_id_source_document_id_idx" ON "documents"("tenant_id", "business_id", "source_document_id");
CREATE INDEX IF NOT EXISTS "documents_tenant_id_business_id_reference_document_id_idx" ON "documents"("tenant_id", "business_id", "reference_document_id");
CREATE INDEX IF NOT EXISTS "purchase_orders_tenant_id_business_id_supplier_id_idx" ON "purchase_orders"("tenant_id", "business_id", "supplier_id");
