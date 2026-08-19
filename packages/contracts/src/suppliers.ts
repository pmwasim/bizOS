import { z } from "zod";

import { isSupportedTaxCountry, validateTaxId } from "./tax-engine.js";

const supplierRequestBaseSchema = z.strictObject({
  name: z.string().trim().min(1).max(200),
  contactName: z.string().trim().max(120).nullable().optional(),
  email: z.email().nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  addressLine1: z.string().trim().max(200).nullable().optional(),
  addressLine2: z.string().trim().max(200).nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  postalCode: z.string().trim().max(32).nullable().optional(),
  countryCode: z.string().length(2).nullable().optional(),
  taxId: z.string().trim().max(80).nullable().optional(),
  taxName: z.string().trim().max(80).nullable().optional(),
  bankName: z.string().trim().max(120).nullable().optional(),
  iban: z.string().trim().max(34).nullable().optional(),
  swiftCode: z.string().trim().max(11).nullable().optional(),
  paymentTerms: z.number().int().min(0).max(365).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

/**
 * When both a supported `countryCode` (SA/AE/IN) and a `taxId` are present in the same payload,
 * enforce the country-specific tax-ID format. When only one of the two is supplied (common on a
 * partial update that touches just the tax ID), the authoritative check runs server-side in
 * `SuppliersService`, which combines the incoming value with the stored record.
 */
function checkTaxId(
  value: { countryCode?: string | null | undefined; taxId?: string | null | undefined },
  ctx: z.RefinementCtx,
): void {
  if (value.taxId && isSupportedTaxCountry(value.countryCode)) {
    const result = validateTaxId(value.countryCode, value.taxId);
    if (!result.valid) {
      ctx.addIssue({
        code: "custom",
        message: result.reason ?? "Invalid tax ID.",
        path: ["taxId"],
      });
    }
  }
}

export const createSupplierRequestSchema = supplierRequestBaseSchema.superRefine(checkTaxId);

export const updateSupplierRequestSchema = supplierRequestBaseSchema
  .partial()
  .superRefine(checkTaxId);

export const supplierSchema = z.strictObject({
  id: z.uuid(),
  name: z.string(),
  contactName: z.string().nullable(),
  email: z.email().nullable(),
  phone: z.string().nullable(),
  addressLine1: z.string().nullable(),
  addressLine2: z.string().nullable(),
  city: z.string().nullable(),
  postalCode: z.string().nullable(),
  countryCode: z.string().nullable(),
  taxId: z.string().nullable(),
  taxName: z.string().nullable(),
  bankName: z.string().nullable(),
  iban: z.string().nullable(),
  swiftCode: z.string().nullable(),
  paymentTerms: z.number().int().nullable(),
  notes: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type CreateSupplierRequest = z.infer<typeof createSupplierRequestSchema>;
export type UpdateSupplierRequest = z.infer<typeof updateSupplierRequestSchema>;
export type Supplier = z.infer<typeof supplierSchema>;
