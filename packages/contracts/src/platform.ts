import { z } from "zod";

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
  quotationPrefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{1,12}$/),
  quotationValidityDays: z.number().int().min(1).max(365),
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
  role: z.enum(["OWNER", "ADMIN", "MEMBER"]),
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
export type CreateBusinessRequest = z.infer<typeof createBusinessRequestSchema>;
export type CurrentUserWorkspace = z.infer<typeof currentUserWorkspaceSchema>;
export type UpdateBusinessSettingsRequest = z.infer<typeof updateBusinessSettingsRequestSchema>;
