import { z } from "zod";

const decimalSchema = z
  .string()
  .trim()
  .regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/);

export const leadStatusSchema = z.enum(["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "LOST"]);

export const leadStatusLabelByCode = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  CONVERTED: "Converted",
  LOST: "Lost",
} as const satisfies Record<z.infer<typeof leadStatusSchema>, string>;

export function leadStatusLabel(status: z.infer<typeof leadStatusSchema>): string {
  return leadStatusLabelByCode[status];
}

export const createLeadRequestSchema = z.strictObject({
  name: z.string().trim().min(1).max(200),
  company: z.string().trim().max(200).nullable().optional(),
  email: z.email().nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  source: z.string().trim().max(80).nullable().optional(),
  estimatedValue: decimalSchema.nullable().optional(),
  currencyCode: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .nullable()
    .optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export const updateLeadRequestSchema = createLeadRequestSchema.extend({
  status: leadStatusSchema.optional(),
});

export const leadSchema = z.strictObject({
  id: z.uuid(),
  name: z.string(),
  company: z.string().nullable(),
  email: z.email().nullable(),
  phone: z.string().nullable(),
  source: z.string().nullable(),
  status: leadStatusSchema,
  score: z.number().int().min(0).max(100),
  estimatedValue: z.string().nullable(),
  currencyCode: z.string().nullable(),
  notes: z.string().nullable(),
  convertedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

/**
 * Response for POST /leads/:leadId/convert. Converting a lead flips its status
 * to CONVERTED and creates a linked opportunity in the same transaction. The
 * created (or, when the lead was already converted, the existing linked)
 * opportunity's public id is returned alongside the lead. `opportunityId` is
 * null only for a lead converted before this progression existed.
 */
export const convertLeadResponseSchema = z.strictObject({
  lead: leadSchema,
  opportunityId: z.uuid().nullable(),
});

export const opportunityStageSchema = z.enum([
  "PROSPECTING",
  "QUALIFICATION",
  "PROPOSAL",
  "NEGOTIATION",
  "CLOSED_WON",
  "CLOSED_LOST",
]);

export const opportunityStageLabelByCode = {
  PROSPECTING: "Prospecting",
  QUALIFICATION: "Qualification",
  PROPOSAL: "Proposal",
  NEGOTIATION: "Negotiation",
  CLOSED_WON: "Closed Won",
  CLOSED_LOST: "Closed Lost",
} as const satisfies Record<z.infer<typeof opportunityStageSchema>, string>;

export function opportunityStageLabel(stage: z.infer<typeof opportunityStageSchema>): string {
  return opportunityStageLabelByCode[stage];
}

export const createOpportunityRequestSchema = z.strictObject({
  leadId: z.uuid().optional(),
  name: z.string().trim().min(1).max(200),
  stage: opportunityStageSchema.optional(),
  probability: z.number().int().min(0).max(100).nullable().optional(),
  amountMinor: decimalSchema.nullable().optional(),
  currencyCode: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .nullable()
    .optional(),
  expectedCloseDate: z.iso.date().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export const updateOpportunityRequestSchema = z.strictObject({
  name: z.string().trim().min(1).max(200).optional(),
  stage: opportunityStageSchema.optional(),
  probability: z.number().int().min(0).max(100).nullable().optional(),
  amountMinor: decimalSchema.nullable().optional(),
  currencyCode: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .nullable()
    .optional(),
  expectedCloseDate: z.iso.date().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export const opportunitySchema = z.strictObject({
  id: z.uuid(),
  name: z.string(),
  stage: opportunityStageSchema,
  probability: z.number().int().nullable(),
  amountMinor: z.string().nullable(),
  currencyCode: z.string().nullable(),
  expectedCloseDate: z.iso.date().nullable(),
  actualCloseDate: z.iso.date().nullable(),
  notes: z.string().nullable(),
  lead: z
    .strictObject({
      id: z.uuid(),
      name: z.string(),
    })
    .nullable(),
  quotation: z
    .strictObject({
      id: z.uuid(),
      number: z.string(),
    })
    .nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type LeadStatus = z.infer<typeof leadStatusSchema>;
export type Lead = z.infer<typeof leadSchema>;
export type CreateLeadRequest = z.infer<typeof createLeadRequestSchema>;
export type UpdateLeadRequest = z.infer<typeof updateLeadRequestSchema>;
export type ConvertLeadResponse = z.infer<typeof convertLeadResponseSchema>;
export type OpportunityStage = z.infer<typeof opportunityStageSchema>;
export type Opportunity = z.infer<typeof opportunitySchema>;
export type CreateOpportunityRequest = z.infer<typeof createOpportunityRequestSchema>;
export type UpdateOpportunityRequest = z.infer<typeof updateOpportunityRequestSchema>;
