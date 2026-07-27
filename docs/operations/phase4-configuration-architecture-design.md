# Phase 4 — Configuration Architecture Design Spec

**Branch:** `feature/default-erp-onboarding-system-admin` **Date:** 2026-07-28 **Inputs:** Phase 2
audit (35 findings, 22 release-blocking), Phase 3 ADR-0019 (no new deps, in-house JSON state
machine, Frappe patterns)

## Decision summary

Per ADR-0019: no new dependencies. Versioned configuration/workflow templates are Prisma tables with
immutable JSON snapshots per version. Workflow steps/transitions/conditions are Zod-validated JSON
structures inside `WorkflowTemplateVersion.definitionJson` (not separate tables) so versions stay
immutable. A small in-house interpreter evaluates the guard DSL (no `eval`, no arbitrary code).

## New Prisma models

Follow existing conventions: `BigInt @id @default(autoincrement())`,
`publicId String @unique @default(uuid()) @map("public_id") @db.Uuid`,
`tenantId BigInt @map("tenant_id")` where tenant-scoped, `@@map("snake_case")`, `@@index` for query
fields, `@@unique` for natural keys, `createdAt/updatedAt` timestamptz.

### Platform-level (no tenant scope)

1. **`ModuleDefinition`** (`@@map("module_definitions")`) — platform ERP module catalog.
   - `code String @unique @db.VarChar(40)` (e.g. `sales`, `purchases`, `inventory`, `projects`)
   - `name String @db.VarChar(80)`, `description String? @db.VarChar(500)`
   - `status ModuleStatus @default(ACTIVE)` enum (`ACTIVE`, `INACTIVE`)
   - `implemented Boolean @default(false)` — whether code exists in this release (drives nav
     visibility)

2. **`ConfigurationTemplate`** (`@@map("configuration_templates")`) — named template.
   - `code String @unique @db.VarChar(40)` (e.g. `default-erp`, `service-po-approval`)
   - `name String @db.VarChar(120)`, `description String? @db.VarChar(500)`
   - `kind ConfigurationTemplateKind` enum (`DEFAULT`, `SPECIALIZED`, `INDUSTRY`)
   - relation `versions ConfigurationTemplateVersion[]`

3. **`ConfigurationTemplateVersion`** (`@@map("configuration_template_versions")`) — immutable
   published version.
   - `templateId BigInt @map("template_id")` → `ConfigurationTemplate`
   - `version String @db.VarChar(20)` (e.g. `1.0.0`)
   - `status ConfigurationVersionStatus` enum (`DRAFT`, `PUBLISHED`, `RETIRED`)
   - `snapshotJson Json @map("snapshot_json")` — immutable: enabled modules, workflow refs, role
     defaults, tax/currency defaults, numbering, document templates, terminology
   - `publishedAt DateTime?`, `retiredAt DateTime?`, `publishedByMembershipId BigInt?`
   - `@@unique([templateId, version])`, `@@index([status])`
   - relations: `assignments BusinessConfigurationAssignment[]`,
     `documentContexts DocumentWorkflowContext[]`

4. **`WorkflowTemplate`** (`@@map("workflow_templates")`) — named workflow per document type.
   - `code String @unique @db.VarChar(40)` (e.g. `sales-workflow`, `procurement-workflow`)
   - `name`, `description`
   - `documentType String @db.VarChar(40)` — which document type this workflow governs (e.g.
     `QUOTATION`, `INVOICE`, `PURCHASE_ORDER`)

5. **`WorkflowTemplateVersion`** (`@@map("workflow_template_versions")`) — immutable published
   workflow definition.
   - `workflowTemplateId BigInt` → `WorkflowTemplate`
   - `version String @db.VarChar(20)`
   - `status WorkflowVersionStatus` enum (`DRAFT`, `PUBLISHED`, `RETIRED`)
   - `definitionJson Json @map("definition_json")` — immutable:
     `{ states: WorkflowStep[], transitions: WorkflowTransition[], actions: ... }`
   - `publishedAt`, `retiredAt`, `publishedByMembershipId BigInt?`
   - `@@unique([workflowTemplateId, version])`, `@@index([status])`
   - relation `documentContexts DocumentWorkflowContext[]`

### Tenant + business scoped

6. **`BusinessConfigurationAssignment`** (`@@map("business_configuration_assignments")`) — one
   primary per business.
   - `tenantId BigInt @map("tenant_id")`, `businessId BigInt @map("business_id")` → `Business`
   - `configurationTemplateVersionId BigInt` → `ConfigurationTemplateVersion`
   - `isPrimary Boolean @default(false) @map("is_primary")`
   - `assignedByMembershipId BigInt? @map("assigned_by_membership_id")`
   - `reason String? @db.VarChar(500)` — change note
   - `assignedAt DateTime @default(now()) @map("assigned_at")`
   - `@@unique([tenantId, businessId, isPrimary])` — partial unique: only one primary (use a
     filtered index or a check; Prisma 7 supports `@@unique` with a filter via raw SQL in migration)
   - `@@index([tenantId, businessId])`, `@@index([configurationTemplateVersionId])`

7. **`DocumentWorkflowContext`** (`@@map("document_workflow_contexts")`) — per-document version
   snapshot.
   - `tenantId`, `businessId` → `Business`
   - `documentId BigInt @unique @map("document_id")` → `Document` (one-to-one)
   - `configurationTemplateVersionId BigInt` → `ConfigurationTemplateVersion`
   - `workflowTemplateVersionId BigInt?` → `WorkflowTemplateVersion` (nullable: not all documents
     have a workflow)
   - `documentType String @db.VarChar(40)`
   - `workflowState String? @db.VarChar(40)` — business workflow state (separate from system
     `Document.status`)
   - `capturedSnapshotJson Json @map("captured_snapshot_json")` — immutable snapshot of relevant
     config at document creation
   - `createdAt DateTime @default(now())`
   - `@@index([tenantId, businessId])`, `@@index([configurationTemplateVersionId])`

8. **`CustomFieldDefinition`** (`@@map("custom_field_definitions")`) — metadata-driven custom
   fields.
   - `tenantId`, `businessId`
   - `documentType String @db.VarChar(40)`, `fieldKey String @db.VarChar(60)`,
     `label String @db.VarChar(120)`
   - `fieldType CustomFieldType` enum (`TEXT`, `NUMBER`, `DATE`, `SELECT`, `BOOLEAN`, `MULTILINE`)
   - `configJson Json @map("config_json")` — options, validation, defaults
   - `@@unique([tenantId, businessId, documentType, fieldKey])`

9. **`IndustryPack`** (`@@map("industry_packs")`) — reusable industry template.
   - `code String @unique @db.VarChar(40)`, `name`, `description`
   - `configurationTemplateId BigInt?` → `ConfigurationTemplate` (nullable: a pack may not yet be
     promoted to a template)
   - `version String @db.VarChar(20)`, `status IndustryPackStatus` enum (`DRAFT`, `PUBLISHED`,
     `RETIRED`)
   - `packJson Json @map("pack_json")` — immutable published snapshot

10. **`FeatureFlag`** (`@@map("feature_flags")`) — tenant + business scoped flags.
    - `tenantId`, `businessId`
    - `flagKey String @db.VarChar(60) @map("flag_key")`, `enabled Boolean @default(false)`,
      `configJson Json?`
    - `@@unique([tenantId, businessId, flagKey])`

11. **`ConfigurationAuditEvent`** (`@@map("configuration_audit_events")`) — field-level audit
    (Frappe-style diff).
    - `tenantId BigInt?` (nullable: platform-level events have no tenant)
    - `actorMembershipId BigInt? @map("actor_membership_id")` (nullable: platform System Admin may
      not be a membership)
    - `actorSystemAdminId BigInt? @map("actor_system_admin_id")` → `PlatformSystemAdmin` (nullable)
    - `action ConfigurationAuditAction` enum (`CREATE`, `UPDATE`, `PUBLISH`, `RETIRE`, `ASSIGN`,
      `UNASSIGN`)
    - `entityType String @db.VarChar(40) @map("entity_type")`, `entityId BigInt @map("entity_id")`
    - `beforeJson Json? @map("before_json")`, `afterJson Json? @map("after_json")`
    - `diffJson Json? @map("diff_json")` — `{ added, changed, removed, row_changed }`
    - `reason String? @db.VarChar(500)`
    - `createdAt DateTime @default(now())`
    - `@@index([tenantId, entityType, entityId])`, `@@index([actorSystemAdminId])`

12. **`CustomizationRequest`** (`@@map("customization_requests")`) — in-product request.
    - `tenantId`, `businessId`
    - `requesterMembershipId BigInt` → `Membership`
    - `currentConfigurationTemplateVersionId BigInt?`
    - `statedProcessJson Json @map("stated_process_json")`
    - `requestedChangesJson Json @map("requested_changes_json")`
    - `urgency CustomizationRequestUrgency` enum (`LOW`, `MEDIUM`, `HIGH`)
    - `notesJson Json? @map("notes_json")`
    - `consentToReview Boolean @default(false) @map("consent_to_review")`
    - `status CustomizationRequestStatus` enum (`OPEN`, `IN_REVIEW`, `RESOLVED`, `REJECTED`)
    - `createdAt`, `updatedAt`
    - `@@index([tenantId, businessId])`, `@@index([status])`

13. **`PlatformSystemAdmin`** (`@@map("platform_system_admins")`) — platform-level admin principal
    (separate from tenant roles).
    - `userId BigInt @unique @map("user_id")` → `User`
    - `status PlatformSystemAdminStatus` enum (`ACTIVE`, `INACTIVE`)
    - `grantedByUserId BigInt? @map("granted_by_user_id")`
    - `reason String? @db.VarChar(500)`
    - `grantedAt DateTime @default(now()) @map("granted_at")`
    - `createdAt`, `updatedAt`
    - relations: `auditEvents ConfigurationAuditEvent[]`

## New enums

```
enum ModuleStatus { ACTIVE | INACTIVE }
enum ConfigurationTemplateKind { DEFAULT | SPECIALIZED | INDUSTRY }
enum ConfigurationVersionStatus { DRAFT | PUBLISHED | RETIRED }
enum WorkflowVersionStatus { DRAFT | PUBLISHED | RETIRED }
enum CustomFieldType { TEXT | NUMBER | DATE | SELECT | BOOLEAN | MULTILINE }
enum IndustryPackStatus { DRAFT | PUBLISHED | RETIRED }
enum ConfigurationAuditAction { CREATE | UPDATE | PUBLISH | RETIRE | ASSIGN | UNASSIGN }
enum CustomizationRequestUrgency { LOW | MEDIUM | HIGH }
enum CustomizationRequestStatus { OPEN | IN_REVIEW | RESOLVED | REJECTED }
enum PlatformSystemAdminStatus { ACTIVE | INACTIVE }
```

## Zod contracts (`packages/contracts/src/`)

New files:

- `configuration.ts` — schemas for `ConfigurationTemplate`, `ConfigurationTemplateVersion`,
  `snapshotJson` shape (modules, workflow refs, role defaults, tax/currency defaults, numbering,
  document templates, terminology), `BusinessConfigurationAssignment`.
- `workflows.ts` — schemas for `WorkflowTemplate`, `WorkflowTemplateVersion`, and the JSON
  structures: `WorkflowStep` (`{ key, label, status, isOptional }`), `WorkflowTransition`
  (`{ fromState, action, toState, allowedRoles[], guard? }`), `WorkflowCondition` (the guard DSL:
  `{ field, operator, value }` with operators
  `eq | neq | lt | lte | gt | gte | in | notIn | exists | notExists`). Validate the guard DSL
  strictly — no arbitrary expressions.
- `customization.ts` — schemas for `CustomizationRequest`, `CustomFieldDefinition`, `FeatureFlag`.
- Update `index.ts` barrel exports if one exists.

## Migration

Single additive migration:
`packages/database/prisma/migrations/20260728020000_configuration_foundation/migration.sql`.

Requirements:

- All `CREATE TABLE` statements are additive (no drops, no alters of existing tables).
- The `BusinessConfigurationAssignment` "one primary per business" constraint: use a partial unique
  index in PostgreSQL:
  `CREATE UNIQUE INDEX business_configuration_assignments_one_primary ON business_configuration_assignments (tenant_id, business_id) WHERE is_primary = true;`
  (Prisma `@@unique` can't express filtered uniqueness, so add it as raw SQL in the migration).
- Indexes on all query fields listed above.
- Foreign keys with `ON DELETE RESTRICT` for template/version references, `ON DELETE CASCADE` for
  document context tied to a document.
- Backfill is NOT in this migration — backfill (assigning existing businesses) is Phase 13 and runs
  as a separate data migration after schema is in place.

## Verification

The implementer must run and confirm green:

1. `pnpm prisma format` (schema formatting)
2. `pnpm prisma validate` (schema valid)
3. `pnpm prisma generate` (client regenerated)
4. `pnpm db:validate` (migration matches schema)
5. `pnpm typecheck` (contracts compile)
6. `pnpm format:check` (prettier)

Do NOT run `prisma migrate dev` (that would apply the migration to a local DB; the migration file is
created by `prisma migrate dev --create-only --name configuration_foundation` or by hand-writing the
SQL). The migration is applied to production in Phase 17 via the controlled deploy job.

## Constraints

- No new npm dependencies.
- No changes to existing models except adding relation fields (e.g.
  `Business.assignments BusinessConfigurationAssignment[]`,
  `Document.workflowContext DocumentWorkflowContext?`,
  `Membership.auditEvents ConfigurationAuditEvent[]`, `User.systemAdmin PlatformSystemAdmin?`).
- Do NOT remove or rename any existing fields, enums, or tables.
- Do NOT change existing service code in this PR — that is Phase 5-7.
- The migration must be repeat-safe (additive only; no data backfill in this migration).
