import {
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";

import {
  QLOUDI_PRO_ENTITLEMENT_ID,
  type BillingEntitlementsResponse,
} from "@bizo/contracts/billing";

import { REVENUECAT_CLIENT, type RevenueCatClient } from "./billing.tokens.js";

@Injectable()
export class BillingService {
  constructor(@Inject(REVENUECAT_CLIENT) private readonly revenueCat: RevenueCatClient) {}

  getEntitlementsForUser(userPublicId: string): Promise<BillingEntitlementsResponse> {
    return this.revenueCat.getEntitlements(userPublicId);
  }

  /**
   * Authoritative gate for Qloudi Pro. Call from feature handlers that must not trust the client.
   * When RevenueCat is not configured, fails closed in production-minded callers via 503.
   */
  async assertQloudiPro(userPublicId: string): Promise<BillingEntitlementsResponse> {
    const entitlements = await this.revenueCat.getEntitlements(userPublicId);
    if (!entitlements.configured) {
      throw new ServiceUnavailableException(
        "Subscription verification is not configured. Set REVENUECAT_API_KEY on the API.",
      );
    }
    if (!entitlements.hasQloudiPro) {
      throw new ForbiddenException(
        `Active entitlement "${QLOUDI_PRO_ENTITLEMENT_ID}" is required for this action.`,
      );
    }
    return entitlements;
  }
}
