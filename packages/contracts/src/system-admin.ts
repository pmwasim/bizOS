import { z } from "zod";

// Phase 9 — Platform System Admin contracts.
//
// The System Admin is a separate authorization boundary from organization
// Owner/Admin. System Admins can inspect and assign configurations across
// tenants; organization admins cannot. These contracts describe the request
// and response shapes for the /api/v1/system-admin/* endpoints.
//
// All System Admin writes require a non-empty `reason` (change note) and
// produce a ConfigurationAuditEvent with actor=systemAdminId.

export const platformSystemAdminStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);

export const systemAdminPrincipalSchema = z.strictObject({
  systemAdminId: z.uuid(),
  userId: z.uuid(),
  status: platformSystemAdminStatusSchema,
  isActive: z.boolean(),
});

export const systemAdminOrganizationSummarySchema = z.strictObject({
  businessId: z.uuid(),
  tenantId: z.uuid(),
  name: z.string(),
  countryCode: z.string(),
  baseCurrency: z.string(),
  currencyScale: z.number().int(),
  locale: z.string(),
  timeZone: z.string(),
  currentAssignment: z
    .strictObject({
      assignmentId: z.uuid(),
      configurationTemplateVersionId: z.uuid(),
      templateCode: z.string(),
      templateVersion: z.string(),
      isPrimary: z.boolean(),
      assignedAt: z.iso.datetime(),
    })
    .nullable(),
});

export const systemAdminOrganizationDetailSchema = systemAdminOrganizationSummarySchema.extend({
  legalName: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  addressLine1: z.string().nullable(),
  addressLine2: z.string().nullable(),
  city: z.string().nullable(),
  postalCode: z.string().nullable(),
  enabledModules: z.array(
    z.strictObject({
      code: z.string(),
      name: z.string(),
      implemented: z.boolean(),
      status: z.enum(["ACTIVE", "INACTIVE"]),
    }),
  ),
});

export const systemAdminAssignmentHistoryItemSchema = z.strictObject({
  id: z.uuid(),
  businessId: z.uuid(),
  configurationTemplateVersionId: z.uuid(),
  templateCode: z.string(),
  templateVersion: z.string(),
  isPrimary: z.boolean(),
  assignedByMembershipId: z.uuid().nullable(),
  reason: z.string().nullable(),
  assignedAt: z.iso.datetime(),
});

export const systemAdminConfigurationTemplateSummarySchema = z.strictObject({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  kind: z.enum(["DEFAULT", "SPECIALIZED", "INDUSTRY"]),
  versions: z.array(
    z.strictObject({
      id: z.uuid(),
      version: z.string(),
      status: z.enum(["DRAFT", "PUBLISHED", "RETIRED"]),
      publishedAt: z.iso.datetime().nullable(),
      retiredAt: z.iso.datetime().nullable(),
      createdAt: z.iso.datetime(),
      updatedAt: z.iso.datetime(),
    }),
  ),
});

export const systemAdminWorkflowTemplateSummarySchema = z.strictObject({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  documentType: z.string(),
  versions: z.array(
    z.strictObject({
      id: z.uuid(),
      version: z.string(),
      status: z.enum(["DRAFT", "PUBLISHED", "RETIRED"]),
      publishedAt: z.iso.datetime().nullable(),
      retiredAt: z.iso.datetime().nullable(),
      createdAt: z.iso.datetime(),
      updatedAt: z.iso.datetime(),
    }),
  ),
});

export const systemAdminCustomizationRequestSummarySchema = z.strictObject({
  id: z.uuid(),
  tenantId: z.uuid(),
  businessId: z.uuid(),
  requesterMembershipId: z.uuid(),
  currentConfigurationTemplateVersionId: z.uuid().nullable(),
  urgency: z.enum(["LOW", "MEDIUM", "HIGH"]),
  status: z.enum(["OPEN", "IN_REVIEW", "RESOLVED", "REJECTED"]),
  consentToReview: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const systemAdminAuditEventSummarySchema = z.strictObject({
  id: z.uuid(),
  tenantId: z.uuid().nullable(),
  actorMembershipId: z.uuid().nullable(),
  actorSystemAdminId: z.uuid().nullable(),
  action: z.enum(["CREATE", "UPDATE", "PUBLISH", "RETIRE", "ASSIGN", "UNASSIGN"]),
  entityType: z.string(),
  entityId: z.string(),
  reason: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

export const systemAdminHealthSummarySchema = z.strictObject({
  service: z.literal("api"),
  status: z.enum(["ok", "degraded", "down"]),
  timestamp: z.iso.datetime(),
  checks: z.record(
    z.string(),
    z.strictObject({
      status: z.enum(["ok", "degraded", "down"]),
      detail: z.string().optional(),
    }),
  ),
});

export const systemAdminAssignConfigurationRequestSchema = z.strictObject({
  configurationTemplateVersionId: z.uuid(),
  reason: z.string().trim().min(1, "Provide a reason for this assignment change.").max(500),
  confirm: z.boolean().default(false),
});

export const systemAdminSetDefaultErpVersionRequestSchema = z.strictObject({
  configurationTemplateVersionId: z.uuid(),
  reason: z.string().trim().min(1, "Provide a reason for this default change.").max(500),
  confirm: z.boolean().default(false),
});

export const systemAdminListOrganizationsRequestSchema = z.strictObject({
  search: z.string().trim().max(160).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const systemAdminListCustomizationRequestsRequestSchema = z.strictObject({
  status: z.enum(["OPEN", "IN_REVIEW", "RESOLVED", "REJECTED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const systemAdminListAuditEventsRequestSchema = z.strictObject({
  entityType: z.string().trim().max(40).optional(),
  businessPublicId: z.uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const systemAdminListConfigurationTemplatesRequestSchema = z.strictObject({
  templateCode: z.string().trim().max(40).optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "RETIRED"]).optional(),
});

export const systemAdminListWorkflowTemplatesRequestSchema = z.strictObject({
  workflowTemplateCode: z.string().trim().max(40).optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "RETIRED"]).optional(),
});

export const paginatedSchema = <T extends z.ZodType>(item: T) =>
  z.strictObject({
    items: z.array(item),
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
  });

export const systemAdminOrganizationPageSchema = paginatedSchema(
  systemAdminOrganizationSummarySchema,
);

export const systemAdminCustomizationRequestPageSchema = paginatedSchema(
  systemAdminCustomizationRequestSummarySchema,
);

export const systemAdminAuditEventPageSchema = paginatedSchema(systemAdminAuditEventSummarySchema);

export type PlatformSystemAdminStatus = z.infer<typeof platformSystemAdminStatusSchema>;
export type SystemAdminPrincipal = z.infer<typeof systemAdminPrincipalSchema>;
export type SystemAdminOrganizationSummary = z.infer<typeof systemAdminOrganizationSummarySchema>;
export type SystemAdminOrganizationDetail = z.infer<typeof systemAdminOrganizationDetailSchema>;
export type SystemAdminAssignmentHistoryItem = z.infer<
  typeof systemAdminAssignmentHistoryItemSchema
>;
export type SystemAdminConfigurationTemplateSummary = z.infer<
  typeof systemAdminConfigurationTemplateSummarySchema
>;
export type SystemAdminWorkflowTemplateSummary = z.infer<
  typeof systemAdminWorkflowTemplateSummarySchema
>;
export type SystemAdminCustomizationRequestSummary = z.infer<
  typeof systemAdminCustomizationRequestSummarySchema
>;
export type SystemAdminAuditEventSummary = z.infer<typeof systemAdminAuditEventSummarySchema>;
export type SystemAdminHealthSummary = z.infer<typeof systemAdminHealthSummarySchema>;
export type SystemAdminAssignConfigurationRequest = z.infer<
  typeof systemAdminAssignConfigurationRequestSchema
>;
export type SystemAdminSetDefaultErpVersionRequest = z.infer<
  typeof systemAdminSetDefaultErpVersionRequestSchema
>;
export type SystemAdminListOrganizationsRequest = z.infer<
  typeof systemAdminListOrganizationsRequestSchema
>;
export type SystemAdminListCustomizationRequestsRequest = z.infer<
  typeof systemAdminListCustomizationRequestsRequestSchema
>;
export type SystemAdminListAuditEventsRequest = z.infer<
  typeof systemAdminListAuditEventsRequestSchema
>;
export type SystemAdminListConfigurationTemplatesRequest = z.infer<
  typeof systemAdminListConfigurationTemplatesRequestSchema
>;
export type SystemAdminListWorkflowTemplatesRequest = z.infer<
  typeof systemAdminListWorkflowTemplatesRequestSchema
>;
export type SystemAdminOrganizationPage = z.infer<typeof systemAdminOrganizationPageSchema>;
export type SystemAdminCustomizationRequestPage = z.infer<
  typeof systemAdminCustomizationRequestPageSchema
>;
export type SystemAdminAuditEventPage = z.infer<typeof systemAdminAuditEventPageSchema>;
