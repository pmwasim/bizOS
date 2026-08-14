import { z } from "zod";

// Phase 4 — Customization request, custom field, and feature flag contracts.

export const customFieldTypeSchema = z.enum([
  "TEXT",
  "NUMBER",
  "DATE",
  "SELECT",
  "BOOLEAN",
  "MULTILINE",
]);

export const customizationRequestUrgencySchema = z.enum(["LOW", "MEDIUM", "HIGH"]);

export const customizationRequestStatusSchema = z.enum([
  "OPEN",
  "IN_REVIEW",
  "RESOLVED",
  "REJECTED",
]);

export const customFieldSelectOptionSchema = z.strictObject({
  value: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(120),
});

export const customFieldConfigSchema = z.strictObject({
  options: z.array(customFieldSelectOptionSchema).max(50).optional(),
  required: z.boolean().default(false),
  defaultValue: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
  validationRegex: z.string().max(500).optional(),
  helpText: z.string().max(500).optional(),
});

export const customFieldDefinitionSchema = z.strictObject({
  id: z.uuid(),
  tenantId: z.uuid(),
  businessId: z.uuid(),
  documentType: z.string().min(1).max(40),
  fieldKey: z.string().min(1).max(60),
  label: z.string().min(1).max(120),
  fieldType: customFieldTypeSchema,
  config: customFieldConfigSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const featureFlagSchema = z.strictObject({
  id: z.uuid(),
  tenantId: z.uuid(),
  businessId: z.uuid(),
  flagKey: z.string().min(1).max(60),
  enabled: z.boolean(),
  config: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const customizationRequestSchema = z.strictObject({
  id: z.uuid(),
  tenantId: z.uuid(),
  businessId: z.uuid(),
  requesterMembershipId: z.uuid(),
  currentConfigurationTemplateVersionId: z.uuid().nullable(),
  statedProcess: z.record(z.string(), z.unknown()),
  requestedChanges: z.record(z.string(), z.unknown()),
  urgency: customizationRequestUrgencySchema,
  notes: z.record(z.string(), z.unknown()).optional(),
  consentToReview: z.boolean(),
  status: customizationRequestStatusSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const createCustomFieldDefinitionSchema = z.strictObject({
  documentType: z.string().trim().min(1).max(40),
  fieldKey: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(
      /^[a-z0-9_]{2,60}$/,
      "Field key must contain only lowercase letters, numbers, and underscores.",
    ),
  label: z.string().trim().min(1).max(120),
  fieldType: customFieldTypeSchema,
  config: customFieldConfigSchema.optional().default({ required: false }),
});

export const updateCustomFieldDefinitionSchema = z.strictObject({
  label: z.string().trim().min(1).max(120).optional(),
  config: customFieldConfigSchema.optional(),
});

export const listCustomFieldDefinitionsResponseSchema = z.strictObject({
  items: z.array(customFieldDefinitionSchema),
});

export type CustomFieldType = z.infer<typeof customFieldTypeSchema>;
export type CustomFieldConfig = z.infer<typeof customFieldConfigSchema>;
export type CustomFieldDefinition = z.infer<typeof customFieldDefinitionSchema>;
export type CreateCustomFieldDefinition = z.infer<typeof createCustomFieldDefinitionSchema>;
export type UpdateCustomFieldDefinition = z.infer<typeof updateCustomFieldDefinitionSchema>;
export type ListCustomFieldDefinitionsResponse = z.infer<
  typeof listCustomFieldDefinitionsResponseSchema
>;
export type FeatureFlag = z.infer<typeof featureFlagSchema>;
export const createCustomizationRequestSchema = z.strictObject({
  statedProcess: z.string().trim().min(1).max(5000),
  requestedChanges: z.string().trim().min(1).max(5000),
  urgency: customizationRequestUrgencySchema,
  notes: z.string().trim().max(2000).optional(),
  consentToReview: z.literal(true),
});

export const businessCustomizationRequestSummarySchema = z.strictObject({
  id: z.uuid(),
  businessId: z.uuid(),
  requesterMembershipId: z.uuid(),
  currentConfigurationTemplateVersionId: z.uuid().nullable(),
  statedProcess: z.record(z.string(), z.unknown()),
  requestedChanges: z.record(z.string(), z.unknown()),
  urgency: customizationRequestUrgencySchema,
  notes: z.record(z.string(), z.unknown()).optional(),
  consentToReview: z.boolean(),
  status: customizationRequestStatusSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const listBusinessCustomizationRequestsResponseSchema = z.strictObject({
  items: z.array(businessCustomizationRequestSummarySchema),
});

export type CustomizationRequestUrgency = z.infer<typeof customizationRequestUrgencySchema>;
export type CustomizationRequestStatus = z.infer<typeof customizationRequestStatusSchema>;
export type CustomizationRequest = z.infer<typeof customizationRequestSchema>;
export type CreateCustomizationRequest = z.infer<typeof createCustomizationRequestSchema>;
export type BusinessCustomizationRequestSummary = z.infer<
  typeof businessCustomizationRequestSummarySchema
>;
export type ListBusinessCustomizationRequestsResponse = z.infer<
  typeof listBusinessCustomizationRequestsResponseSchema
>;
