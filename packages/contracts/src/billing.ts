import { z } from "zod";

/** Dashboard entitlement lookup_key — keep in sync with apps/web revenuecat constants. */
export const QLOUDI_PRO_ENTITLEMENT_ID = "Qloudi Pro";

export const billingEntitlementSchema = z.object({
  expiresAt: z.iso.datetime().nullable(),
  identifier: z.string().min(1),
  productIdentifier: z.string().min(1).nullable(),
  willRenew: z.boolean(),
});

export const billingEntitlementsResponseSchema = z.object({
  activeEntitlementIds: z.array(z.string()),
  configured: z.boolean(),
  entitlements: z.array(billingEntitlementSchema),
  hasQloudiPro: z.boolean(),
  managementUrl: z.url().nullable(),
});

export type BillingEntitlement = z.infer<typeof billingEntitlementSchema>;
export type BillingEntitlementsResponse = z.infer<typeof billingEntitlementsResponseSchema>;
