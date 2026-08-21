/**
 * RevenueCat catalog identifiers for Qloudi Pro.
 * Keep these aligned with the dashboard (project projfc47935f).
 */
export const QLOUDI_PRO_ENTITLEMENT_ID = "Qloudi Pro";

export const PRODUCT_IDENTIFIERS = {
  monthly: "monthly",
  yearly: "yearly",
  lifetime: "lifetime",
} as const;

/** Dashboard package lookup keys on the current `default` offering. */
export const PACKAGE_IDENTIFIERS = {
  monthly: "$rc_monthly",
  yearly: "$rc_annual",
  lifetime: "$rc_lifetime",
} as const;

export type ProductIdentifier = (typeof PRODUCT_IDENTIFIERS)[keyof typeof PRODUCT_IDENTIFIERS];
export type PackageIdentifier = (typeof PACKAGE_IDENTIFIERS)[keyof typeof PACKAGE_IDENTIFIERS];
