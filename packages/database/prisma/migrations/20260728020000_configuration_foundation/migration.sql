-- Phase 4 — Configuration architecture foundation.
-- Additive only: 10 new enums, 13 new tables, indexes, and FKs.
-- No drops, no alters of existing tables. Backfill is Phase 13.

-- CreateEnum
CREATE TYPE "ModuleStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ConfigurationTemplateKind" AS ENUM ('DEFAULT', 'SPECIALIZED', 'INDUSTRY');

-- CreateEnum
CREATE TYPE "ConfigurationVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED');

-- CreateEnum
CREATE TYPE "WorkflowVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED');

-- CreateEnum
CREATE TYPE "CustomFieldType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'SELECT', 'BOOLEAN', 'MULTILINE');

-- CreateEnum
CREATE TYPE "IndustryPackStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED');

-- CreateEnum
CREATE TYPE "ConfigurationAuditAction" AS ENUM ('CREATE', 'UPDATE', 'PUBLISH', 'RETIRE', 'ASSIGN', 'UNASSIGN');

-- CreateEnum
CREATE TYPE "CustomizationRequestUrgency" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "CustomizationRequestStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PlatformSystemAdminStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "module_definitions" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" VARCHAR(500),
    "status" "ModuleStatus" NOT NULL DEFAULT 'ACTIVE',
    "implemented" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "module_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuration_templates" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "kind" "ConfigurationTemplateKind" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "configuration_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuration_template_versions" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "template_id" BIGINT NOT NULL,
    "version" VARCHAR(20) NOT NULL,
    "status" "ConfigurationVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "snapshot_json" JSONB NOT NULL,
    "published_at" TIMESTAMPTZ(3),
    "retired_at" TIMESTAMPTZ(3),
    "published_by_membership_id" BIGINT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "configuration_template_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_templates" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "document_type" VARCHAR(40) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "workflow_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_template_versions" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "workflow_template_id" BIGINT NOT NULL,
    "version" VARCHAR(20) NOT NULL,
    "status" "WorkflowVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "definition_json" JSONB NOT NULL,
    "published_at" TIMESTAMPTZ(3),
    "retired_at" TIMESTAMPTZ(3),
    "published_by_membership_id" BIGINT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "workflow_template_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_configuration_assignments" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "business_id" BIGINT NOT NULL,
    "configuration_template_version_id" BIGINT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "assigned_by_membership_id" BIGINT,
    "reason" VARCHAR(500),
    "assigned_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_configuration_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_workflow_contexts" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "business_id" BIGINT NOT NULL,
    "document_id" BIGINT NOT NULL,
    "configuration_template_version_id" BIGINT NOT NULL,
    "workflow_template_version_id" BIGINT,
    "document_type" VARCHAR(40) NOT NULL,
    "workflow_state" VARCHAR(40),
    "captured_snapshot_json" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "document_workflow_contexts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_field_definitions" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "business_id" BIGINT NOT NULL,
    "document_type" VARCHAR(40) NOT NULL,
    "field_key" VARCHAR(60) NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "field_type" "CustomFieldType" NOT NULL,
    "config_json" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "custom_field_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "industry_packs" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "configuration_template_id" BIGINT,
    "version" VARCHAR(20) NOT NULL,
    "status" "IndustryPackStatus" NOT NULL DEFAULT 'DRAFT',
    "pack_json" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "industry_packs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "business_id" BIGINT NOT NULL,
    "flag_key" VARCHAR(60) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "config_json" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuration_audit_events" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "tenant_id" BIGINT,
    "actor_membership_id" BIGINT,
    "actor_system_admin_id" BIGINT,
    "action" "ConfigurationAuditAction" NOT NULL,
    "entity_type" VARCHAR(40) NOT NULL,
    "entity_id" BIGINT NOT NULL,
    "before_json" JSONB,
    "after_json" JSONB,
    "diff_json" JSONB,
    "reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "configuration_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customization_requests" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "business_id" BIGINT NOT NULL,
    "requester_membership_id" BIGINT NOT NULL,
    "current_configuration_template_version_id" BIGINT,
    "stated_process_json" JSONB NOT NULL,
    "requested_changes_json" JSONB NOT NULL,
    "urgency" "CustomizationRequestUrgency" NOT NULL,
    "notes_json" JSONB,
    "consent_to_review" BOOLEAN NOT NULL DEFAULT false,
    "status" "CustomizationRequestStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "customization_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_system_admins" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "user_id" BIGINT NOT NULL,
    "status" "PlatformSystemAdminStatus" NOT NULL DEFAULT 'ACTIVE',
    "granted_by_user_id" BIGINT,
    "reason" VARCHAR(500),
    "granted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "platform_system_admins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "module_definitions_public_id_key" ON "module_definitions"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "module_definitions_code_key" ON "module_definitions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "configuration_templates_public_id_key" ON "configuration_templates"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "configuration_templates_code_key" ON "configuration_templates"("code");

-- CreateIndex
CREATE UNIQUE INDEX "configuration_template_versions_public_id_key" ON "configuration_template_versions"("public_id");

-- CreateIndex
CREATE INDEX "configuration_template_versions_status_idx" ON "configuration_template_versions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "configuration_template_versions_template_id_version_key" ON "configuration_template_versions"("template_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_templates_public_id_key" ON "workflow_templates"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_templates_code_key" ON "workflow_templates"("code");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_template_versions_public_id_key" ON "workflow_template_versions"("public_id");

-- CreateIndex
CREATE INDEX "workflow_template_versions_status_idx" ON "workflow_template_versions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_template_versions_workflow_template_id_version_key" ON "workflow_template_versions"("workflow_template_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "business_configuration_assignments_public_id_key" ON "business_configuration_assignments"("public_id");

-- CreateIndex
CREATE INDEX "business_configuration_assignments_tenant_id_business_id_idx" ON "business_configuration_assignments"("tenant_id", "business_id");

-- CreateIndex
CREATE INDEX "business_configuration_assignments_configuration_template_v_idx" ON "business_configuration_assignments"("configuration_template_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_workflow_contexts_public_id_key" ON "document_workflow_contexts"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_workflow_contexts_document_id_key" ON "document_workflow_contexts"("document_id");

-- CreateIndex
CREATE INDEX "document_workflow_contexts_tenant_id_business_id_idx" ON "document_workflow_contexts"("tenant_id", "business_id");

-- CreateIndex
CREATE INDEX "document_workflow_contexts_configuration_template_version_i_idx" ON "document_workflow_contexts"("configuration_template_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "custom_field_definitions_public_id_key" ON "custom_field_definitions"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "custom_field_definitions_tenant_id_business_id_document_typ_key" ON "custom_field_definitions"("tenant_id", "business_id", "document_type", "field_key");

-- CreateIndex
CREATE UNIQUE INDEX "industry_packs_public_id_key" ON "industry_packs"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "industry_packs_code_key" ON "industry_packs"("code");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_public_id_key" ON "feature_flags"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_tenant_id_business_id_flag_key_key" ON "feature_flags"("tenant_id", "business_id", "flag_key");

-- CreateIndex
CREATE UNIQUE INDEX "configuration_audit_events_public_id_key" ON "configuration_audit_events"("public_id");

-- CreateIndex
CREATE INDEX "configuration_audit_events_tenant_id_entity_type_entity_id_idx" ON "configuration_audit_events"("tenant_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "configuration_audit_events_actor_system_admin_id_idx" ON "configuration_audit_events"("actor_system_admin_id");

-- CreateIndex
CREATE UNIQUE INDEX "customization_requests_public_id_key" ON "customization_requests"("public_id");

-- CreateIndex
CREATE INDEX "customization_requests_tenant_id_business_id_idx" ON "customization_requests"("tenant_id", "business_id");

-- CreateIndex
CREATE INDEX "customization_requests_status_idx" ON "customization_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "platform_system_admins_public_id_key" ON "platform_system_admins"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_system_admins_user_id_key" ON "platform_system_admins"("user_id");

-- AddForeignKey
ALTER TABLE "configuration_template_versions" ADD CONSTRAINT "configuration_template_versions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "configuration_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_template_versions" ADD CONSTRAINT "workflow_template_versions_workflow_template_id_fkey" FOREIGN KEY ("workflow_template_id") REFERENCES "workflow_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_configuration_assignments" ADD CONSTRAINT "business_configuration_assignments_tenant_id_business_id_fkey" FOREIGN KEY ("tenant_id", "business_id") REFERENCES "businesses"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_configuration_assignments" ADD CONSTRAINT "business_configuration_assignments_configuration_template__fkey" FOREIGN KEY ("configuration_template_version_id") REFERENCES "configuration_template_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_workflow_contexts" ADD CONSTRAINT "document_workflow_contexts_tenant_id_business_id_fkey" FOREIGN KEY ("tenant_id", "business_id") REFERENCES "businesses"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_workflow_contexts" ADD CONSTRAINT "document_workflow_contexts_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_workflow_contexts" ADD CONSTRAINT "document_workflow_contexts_configuration_template_version__fkey" FOREIGN KEY ("configuration_template_version_id") REFERENCES "configuration_template_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_workflow_contexts" ADD CONSTRAINT "document_workflow_contexts_workflow_template_version_id_fkey" FOREIGN KEY ("workflow_template_version_id") REFERENCES "workflow_template_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_field_definitions" ADD CONSTRAINT "custom_field_definitions_tenant_id_business_id_fkey" FOREIGN KEY ("tenant_id", "business_id") REFERENCES "businesses"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "industry_packs" ADD CONSTRAINT "industry_packs_configuration_template_id_fkey" FOREIGN KEY ("configuration_template_id") REFERENCES "configuration_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_tenant_id_business_id_fkey" FOREIGN KEY ("tenant_id", "business_id") REFERENCES "businesses"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuration_audit_events" ADD CONSTRAINT "configuration_audit_events_actor_membership_id_fkey" FOREIGN KEY ("actor_membership_id") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuration_audit_events" ADD CONSTRAINT "configuration_audit_events_actor_system_admin_id_fkey" FOREIGN KEY ("actor_system_admin_id") REFERENCES "platform_system_admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customization_requests" ADD CONSTRAINT "customization_requests_tenant_id_business_id_fkey" FOREIGN KEY ("tenant_id", "business_id") REFERENCES "businesses"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customization_requests" ADD CONSTRAINT "customization_requests_requester_membership_id_fkey" FOREIGN KEY ("requester_membership_id") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customization_requests" ADD CONSTRAINT "customization_requests_current_configuration_template_vers_fkey" FOREIGN KEY ("current_configuration_template_version_id") REFERENCES "configuration_template_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_system_admins" ADD CONSTRAINT "platform_system_admins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Partial unique index: at most one primary configuration assignment per business.
-- Prisma @@unique cannot express filtered uniqueness, so the index is added as raw SQL.
CREATE UNIQUE INDEX "business_configuration_assignments_one_primary"
  ON "business_configuration_assignments" ("tenant_id", "business_id")
  WHERE "is_primary" = true;
