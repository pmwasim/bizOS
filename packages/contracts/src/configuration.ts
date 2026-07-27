import { z } from "zod";

// Phase 4 — Configuration template contracts.
// snapshotJson is the immutable per-version snapshot of enabled modules, workflow refs,
// role defaults, tax/currency defaults, numbering, document templates, and terminology.

export const configurationTemplateKindSchema = z.enum(["DEFAULT", "SPECIALIZED", "INDUSTRY"]);

export const configurationVersionStatusSchema = z.enum(["DRAFT", "PUBLISHED", "RETIRED"]);

export const configurationModuleRefSchema = z.strictObject({
  code: z.string().trim().min(1).max(40),
  enabled: z.boolean().default(false),
});

export const configurationWorkflowRefSchema = z.strictObject({
  documentType: z.string().trim().min(1).max(40),
  workflowTemplateCode: z.string().trim().min(1).max(40),
  // Optional pin to a specific published workflow template version. When omitted,
  // ConfigurationService resolves the latest PUBLISHED version by workflowTemplateCode.
  version: z.string().trim().min(1).max(20).optional(),
});

export const configurationRoleDefaultSchema = z.strictObject({
  roleCode: z.string().trim().min(1).max(80),
  permissions: z.array(z.string().trim().min(1).max(80)).max(100).default([]),
});

export const configurationTaxDefaultsSchema = z.strictObject({
  enabled: z.boolean().default(false),
  name: z.string().trim().min(1).max(80).default("Tax"),
  ratePercent: z
    .string()
    .trim()
    .regex(/^(?:100(?:\.0{1,4})?|\d{1,2}(?:\.\d{1,4})?)$/)
    .default("0"),
  priceIncludesTax: z.boolean().default(false),
});

export const configurationCurrencyDefaultsSchema = z.strictObject({
  currencyCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/),
  currencyScale: z.number().int().min(0).max(4),
});

export const configurationNumberingSchema = z.strictObject({
  quotationPrefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{1,12}$/)
    .default("Q"),
  invoicePrefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{1,12}$/)
    .default("INV"),
  quotationValidityDays: z.number().int().min(1).max(365).default(30),
  invoiceDueDays: z.number().int().min(1).max(365).default(30),
});

export const configurationDocumentTemplateRefSchema = z.strictObject({
  documentType: z.string().trim().min(1).max(40),
  templateName: z.string().trim().min(1).max(80).default("professional-v1"),
});

export const configurationTerminologySchema = z.strictObject({
  quotationLabel: z.string().trim().min(1).max(80).default("Quotation"),
  invoiceLabel: z.string().trim().min(1).max(80).default("Invoice"),
  customerLabel: z.string().trim().min(1).max(80).default("Customer"),
});

export const configurationSnapshotSchema = z.strictObject({
  modules: z.array(configurationModuleRefSchema).max(50).default([]),
  workflows: z.array(configurationWorkflowRefSchema).max(20).default([]),
  roleDefaults: z.array(configurationRoleDefaultSchema).max(20).default([]),
  tax: configurationTaxDefaultsSchema,
  currency: configurationCurrencyDefaultsSchema,
  numbering: configurationNumberingSchema,
  documentTemplates: z.array(configurationDocumentTemplateRefSchema).max(20).default([]),
  terminology: configurationTerminologySchema,
});

export const configurationTemplateSchema = z.strictObject({
  id: z.uuid(),
  code: z.string().min(1).max(40),
  name: z.string().min(1).max(120),
  description: z.string().nullable(),
  kind: configurationTemplateKindSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const configurationTemplateVersionSchema = z.strictObject({
  id: z.uuid(),
  templateId: z.uuid(),
  version: z.string().min(1).max(20),
  status: configurationVersionStatusSchema,
  snapshot: configurationSnapshotSchema,
  publishedAt: z.iso.datetime().nullable(),
  retiredAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const businessConfigurationAssignmentSchema = z.strictObject({
  id: z.uuid(),
  tenantId: z.uuid(),
  businessId: z.uuid(),
  configurationTemplateVersionId: z.uuid(),
  isPrimary: z.boolean(),
  assignedByMembershipId: z.uuid().nullable(),
  reason: z.string().max(500).nullable(),
  assignedAt: z.iso.datetime(),
});

export const enabledModuleSummarySchema = z.strictObject({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(80),
  description: z.string().nullable(),
  implemented: z.boolean(),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

export type ConfigurationTemplateKind = z.infer<typeof configurationTemplateKindSchema>;
export type ConfigurationVersionStatus = z.infer<typeof configurationVersionStatusSchema>;
export type ConfigurationSnapshot = z.infer<typeof configurationSnapshotSchema>;
export type ConfigurationTemplate = z.infer<typeof configurationTemplateSchema>;
export type ConfigurationTemplateVersion = z.infer<typeof configurationTemplateVersionSchema>;
export type BusinessConfigurationAssignment = z.infer<typeof businessConfigurationAssignmentSchema>;
export type EnabledModuleSummary = z.infer<typeof enabledModuleSummarySchema>;
