import {
  QLOUDI_PRO_ENTITLEMENT_ID,
  type BillingEntitlement,
  type BillingEntitlementsResponse,
} from "@bizo/contracts/billing";

interface RevenueCatSubscriberEntitlement {
  expires_date: string | null;
  product_identifier: string | null;
  purchase_date?: string | null;
  will_renew?: boolean;
}

interface RevenueCatSubscriberResponse {
  subscriber: {
    entitlements: Record<string, RevenueCatSubscriberEntitlement>;
    management_url: string | null;
  };
}

export class RevenueCatNotConfiguredError extends Error {
  constructor() {
    super("RevenueCat is not configured on the API (set REVENUECAT_API_KEY).");
    this.name = "RevenueCatNotConfiguredError";
  }
}

export class RevenueCatClient {
  constructor(private readonly apiKey: string | undefined) {}

  isConfigured(): boolean {
    return typeof this.apiKey === "string" && this.apiKey.trim().length >= 8;
  }

  async getEntitlements(appUserId: string): Promise<BillingEntitlementsResponse> {
    if (!this.isConfigured() || !this.apiKey) {
      return {
        activeEntitlementIds: [],
        configured: false,
        entitlements: [],
        hasQloudiPro: false,
        managementUrl: null,
      };
    }

    const encodedUserId = encodeURIComponent(appUserId);
    const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodedUserId}`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      method: "GET",
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `RevenueCat subscriber lookup failed (${response.status}): ${body.slice(0, 200)}`,
      );
    }

    const payload = (await response.json()) as RevenueCatSubscriberResponse;
    const now = Date.now();
    const entitlements: BillingEntitlement[] = [];
    const activeEntitlementIds: string[] = [];

    for (const [identifier, raw] of Object.entries(payload.subscriber.entitlements ?? {})) {
      const expiresAt = raw.expires_date;
      const expired =
        typeof expiresAt === "string" && expiresAt.length > 0
          ? Date.parse(expiresAt) <= now
          : false;
      if (expired) continue;

      activeEntitlementIds.push(identifier);
      entitlements.push({
        expiresAt: expiresAt,
        identifier,
        productIdentifier: raw.product_identifier,
        willRenew: Boolean(raw.will_renew),
      });
    }

    return {
      activeEntitlementIds,
      configured: true,
      entitlements,
      hasQloudiPro: activeEntitlementIds.includes(QLOUDI_PRO_ENTITLEMENT_ID),
      managementUrl: payload.subscriber.management_url || null,
    };
  }
}
