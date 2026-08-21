import type { CustomerInfo, EntitlementInfo, Purchases } from "@revenuecat/purchases-js";

import { QLOUDI_PRO_ENTITLEMENT_ID } from "./constants";

export function hasQloudiPro(customerInfo: CustomerInfo): boolean {
  return QLOUDI_PRO_ENTITLEMENT_ID in customerInfo.entitlements.active;
}

export function getQloudiProEntitlement(customerInfo: CustomerInfo): EntitlementInfo | null {
  return customerInfo.entitlements.active[QLOUDI_PRO_ENTITLEMENT_ID] ?? null;
}

export async function fetchCustomerInfo(purchases: Purchases): Promise<CustomerInfo> {
  return purchases.getCustomerInfo();
}

export async function refreshHasQloudiPro(purchases: Purchases): Promise<boolean> {
  const info = await fetchCustomerInfo(purchases);
  return hasQloudiPro(info);
}
