import { z } from "zod";

import { numberingPadWidthSchema, numberingPrefixSchema } from "./numbering.js";

const countryCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/);
const currencyCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/);
const percentageSchema = z
  .string()
  .trim()
  .regex(/^(?:100(?:\.0{1,4})?|\d{1,2}(?:\.\d{1,4})?)$/);

export const createBusinessRequestSchema = z.strictObject({
  name: z.string().trim().min(2).max(160),
  countryCode: countryCodeSchema,
  baseCurrency: currencyCodeSchema,
  currencyScale: z.number().int().min(0).max(4).default(2),
  locale: z.string().trim().min(2).max(35).default("en"),
  timeZone: z.string().trim().min(1).max(64).default("UTC"),
  taxEnabled: z.boolean().default(false),
  taxName: z.string().trim().min(1).max(80).default("Tax"),
  taxRatePercent: percentageSchema.default("0"),
});

export const updateBusinessSettingsRequestSchema = z.strictObject({
  name: z.string().trim().min(2).max(160),
  legalName: z.string().trim().max(200).nullable(),
  email: z.email().max(320).nullable(),
  phone: z.string().trim().max(40).nullable(),
  addressLine1: z.string().trim().max(200).nullable(),
  addressLine2: z.string().trim().max(200).nullable(),
  city: z.string().trim().max(120).nullable(),
  postalCode: z.string().trim().max(32).nullable(),
  countryCode: countryCodeSchema,
  baseCurrency: currencyCodeSchema,
  currencyScale: z.number().int().min(0).max(4),
  locale: z.string().trim().min(2).max(35),
  timeZone: z.string().trim().min(1).max(64),
  quotationPrefix: numberingPrefixSchema,
  quotationValidityDays: z.number().int().min(1).max(365),
  // Per-document-type numbering prefixes and the shared zero-padding width. Optional so partial
  // settings updates stay valid; the service only writes the ones that are provided.
  invoicePrefix: numberingPrefixSchema.optional(),
  salesOrderPrefix: numberingPrefixSchema.optional(),
  deliveryNotePrefix: numberingPrefixSchema.optional(),
  creditNotePrefix: numberingPrefixSchema.optional(),
  purchaseOrderPrefix: numberingPrefixSchema.optional(),
  supplierPoPrefix: numberingPrefixSchema.optional(),
  supplierBillPrefix: numberingPrefixSchema.optional(),
  paymentPrefix: numberingPrefixSchema.optional(),
  numberPadWidth: numberingPadWidthSchema.optional(),
  defaultMessage: z.string().trim().max(1000).nullable(),
  taxEnabled: z.boolean(),
  taxName: z.string().trim().min(1).max(80),
  taxRegistrationNumber: z.string().trim().max(80).nullable(),
  taxRatePercent: percentageSchema,
});

export const businessSummarySchema = z.strictObject({
  id: z.uuid(),
  tenantId: z.uuid(),
  name: z.string(),
  countryCode: countryCodeSchema,
  baseCurrency: currencyCodeSchema,
  currencyScale: z.number().int(),
  locale: z.string(),
  timeZone: z.string(),
  role: z.enum(["OWNER", "ADMIN", "MEMBER", "STAFF", "ACCOUNTANT", "EXTERNAL_AUDITOR"]),
});

export const businessSettingsSchema = z.strictObject({
  id: z.uuid(),
  name: z.string(),
  legalName: z.string().nullable(),
  email: z.email().nullable(),
  phone: z.string().nullable(),
  addressLine1: z.string().nullable(),
  addressLine2: z.string().nullable(),
  city: z.string().nullable(),
  postalCode: z.string().nullable(),
  countryCode: countryCodeSchema,
  baseCurrency: currencyCodeSchema,
  currencyScale: z.number().int(),
  locale: z.string(),
  timeZone: z.string(),
  quotationPrefix: z.string(),
  quotationValidityDays: z.number().int(),
  invoicePrefix: z.string(),
  salesOrderPrefix: z.string(),
  deliveryNotePrefix: z.string(),
  creditNotePrefix: z.string(),
  purchaseOrderPrefix: z.string(),
  supplierPoPrefix: z.string(),
  supplierBillPrefix: z.string(),
  paymentPrefix: z.string(),
  numberPadWidth: z.number().int(),
  defaultMessage: z.string().nullable(),
  taxEnabled: z.boolean(),
  taxName: z.string(),
  taxRegistrationNumber: z.string().nullable(),
  taxRatePercent: z.string(),
});

export const currentUserWorkspaceSchema = z.strictObject({
  user: z.strictObject({
    id: z.uuid(),
    displayName: z.string(),
    email: z.email(),
    locale: z.string(),
  }),
  businesses: z.array(businessSummarySchema),
});

export type BusinessSummary = z.infer<typeof businessSummarySchema>;
export type BusinessSettings = z.infer<typeof businessSettingsSchema>;
export type CreateBusinessRequest = z.infer<typeof createBusinessRequestSchema>;
export type CurrentUserWorkspace = z.infer<typeof currentUserWorkspaceSchema>;
export type UpdateBusinessSettingsRequest = z.infer<typeof updateBusinessSettingsRequestSchema>;
