import { describe, expect, it } from "vitest";

import { QLOUDI_PRO_ENTITLEMENT_ID, billingEntitlementsResponseSchema } from "./billing.js";

describe("billingEntitlementsResponseSchema", () => {
  it("accepts a configured Qloudi Pro response", () => {
    const parsed = billingEntitlementsResponseSchema.parse({
      activeEntitlementIds: [QLOUDI_PRO_ENTITLEMENT_ID],
      configured: true,
      entitlements: [
        {
          expiresAt: null,
          identifier: QLOUDI_PRO_ENTITLEMENT_ID,
          productIdentifier: "lifetime",
          willRenew: false,
        },
      ],
      hasQloudiPro: true,
      managementUrl: "https://billing.example.test/manage",
    });
    expect(parsed.hasQloudiPro).toBe(true);
  });

  it("accepts an unconfigured billing backend", () => {
    expect(
      billingEntitlementsResponseSchema.parse({
        activeEntitlementIds: [],
        configured: false,
        entitlements: [],
        hasQloudiPro: false,
        managementUrl: null,
      }).configured,
    ).toBe(false);
  });
});
