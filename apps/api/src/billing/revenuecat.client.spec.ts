import { describe, expect, it, vi } from "vitest";

import { QLOUDI_PRO_ENTITLEMENT_ID } from "@bizo/contracts/billing";

import { RevenueCatClient } from "./revenuecat.client.js";

describe("RevenueCatClient", () => {
  it("returns configured:false when no API key is set", async () => {
    const client = new RevenueCatClient(undefined);
    await expect(client.getEntitlements("user-1")).resolves.toEqual({
      activeEntitlementIds: [],
      configured: false,
      entitlements: [],
      hasQloudiPro: false,
      managementUrl: null,
    });
  });

  it("maps active Qloudi Pro entitlements from the subscriber payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        subscriber: {
          entitlements: {
            [QLOUDI_PRO_ENTITLEMENT_ID]: {
              expires_date: null,
              product_identifier: "yearly",
              will_renew: true,
            },
            expired_other: {
              expires_date: "2020-01-01T00:00:00Z",
              product_identifier: "monthly",
              will_renew: false,
            },
          },
          management_url: "https://billing.example.test/portal",
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = new RevenueCatClient("test_public_or_secret_key");
    const result = await client.getEntitlements("user-42");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.revenuecat.com/v1/subscribers/user-42",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test_public_or_secret_key",
        }),
      }),
    );
    expect(result).toEqual({
      activeEntitlementIds: [QLOUDI_PRO_ENTITLEMENT_ID],
      configured: true,
      entitlements: [
        {
          expiresAt: null,
          identifier: QLOUDI_PRO_ENTITLEMENT_ID,
          productIdentifier: "yearly",
          willRenew: true,
        },
      ],
      hasQloudiPro: true,
      managementUrl: "https://billing.example.test/portal",
    });

    vi.unstubAllGlobals();
  });
});
