import { z } from "zod";

import { quotationLineInputSchema } from "./quotations.js";

// Lead/opportunity money fields are integer minor units (Decimal(38,0) in the
// database). Reject a fractional minor value outright: allowing it let the
// scorer truncate while PostgreSQL rounded, so the same input produced two
// different stored/scored amounts.
const decimalSchema = z
  .string()
  .trim()
  .regex(/^(?:0|[1-9]\d*)$/);

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
// Superset of `leadSchema` so the v1 convert endpoint stays backwards
// compatible — existing callers keep reading the lead's fields at the top
// level — while new callers also get the linked opportunity id.
export const convertLeadResponseSchema = leadSchema.extend({
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

/**
 * Body for POST /opportunities/:opportunityId/convert-to-quotation. Every field
 * is optional: the one-click default seeds a customer and a single draft line
 * from the opportunity itself. Callers may override any of them —
 * `customerId` to bill an existing customer, `lines` to hand-author the
 * quotation lines, and the two dates to pin the quotation's issue/validity.
 * `lines` mirrors the quotation engine's own line input so the reused engine
 * validates and calculates them identically.
 */
export const convertOpportunityRequestSchema = z.strictObject({
  customerId: z.uuid().optional(),
  lines: z.array(quotationLineInputSchema).min(1).max(50).optional(),
  issueDate: z.iso.date().optional(),
  validUntil: z.iso.date().optional(),
});

/**
 * Response for POST /opportunities/:opportunityId/convert-to-quotation.
 * Converting an opportunity creates (or, when it was already converted, reuses)
 * a linked quotation and stamps `opportunity.quotationId`. The response is a
 * superset of `opportunitySchema` (v1-compatible: existing callers keep reading
 * the opportunity's fields — including the now-populated nested `quotation` —
 * at the top level) plus the created quotation's public id at `quotationId`.
 */
export const convertOpportunityResponseSchema = opportunitySchema.extend({
  quotationId: z.uuid(),
});

// ── CRM interaction journal (activity timeline) ──────────────────────────────

export const crmActivityTypeSchema = z.enum(["NOTE", "CALL", "EMAIL", "MEETING", "STAGE_CHANGE"]);

export const crmActivityTypeLabelByCode = {
  NOTE: "Note",
  CALL: "Call",
  EMAIL: "Email",
  MEETING: "Meeting",
  STAGE_CHANGE: "Stage change",
} as const satisfies Record<z.infer<typeof crmActivityTypeSchema>, string>;

export function crmActivityTypeLabel(type: z.infer<typeof crmActivityTypeSchema>): string {
  return crmActivityTypeLabelByCode[type];
}

// Users log interactions; STAGE_CHANGE entries are written by the system when an
// opportunity's stage changes, so they cannot be created through the API.
export const createCrmActivityRequestSchema = z
  .strictObject({
    type: z.enum(["NOTE", "CALL", "EMAIL", "MEETING"]),
    subject: z.string().trim().min(1).max(200),
    body: z.string().trim().max(4000).nullable().optional(),
    occurredAt: z.iso.datetime().optional(),
    customerId: z.uuid().nullable().optional(),
    opportunityId: z.uuid().nullable().optional(),
    leadId: z.uuid().nullable().optional(),
  })
  .refine((value) => Boolean(value.customerId || value.opportunityId || value.leadId), {
    message: "An activity must reference a customer, opportunity or lead.",
  });

export const crmActivitySchema = z.strictObject({
  id: z.uuid(),
  type: crmActivityTypeSchema,
  subject: z.string(),
  body: z.string().nullable(),
  occurredAt: z.iso.datetime(),
  customerId: z.uuid().nullable(),
  opportunityId: z.uuid().nullable(),
  leadId: z.uuid().nullable(),
  createdAt: z.iso.datetime(),
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
export type ConvertOpportunityRequest = z.infer<typeof convertOpportunityRequestSchema>;
export type ConvertOpportunityResponse = z.infer<typeof convertOpportunityResponseSchema>;
export type CrmActivityType = z.infer<typeof crmActivityTypeSchema>;
export type CreateCrmActivityRequest = z.infer<typeof createCrmActivityRequestSchema>;
export type CrmActivity = z.infer<typeof crmActivitySchema>;
