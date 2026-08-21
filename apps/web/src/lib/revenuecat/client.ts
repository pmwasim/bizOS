"use client";

import { Purchases } from "@revenuecat/purchases-js";

/**
 * Public Web Billing / Test Store API key (safe to expose in the browser).
 * Set `NEXT_PUBLIC_REVENUECAT_WEB_API_KEY` in `.env` — never commit secret keys.
 */
export function getRevenueCatWebApiKey(): string {
  const key = process.env.NEXT_PUBLIC_REVENUECAT_WEB_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "Missing NEXT_PUBLIC_REVENUECAT_WEB_API_KEY. Add your RevenueCat public Web API key to .env.",
    );
  }
  return key;
}

/**
 * Configure once per browser session. If already configured for a different user,
 * switch with `changeUser` so purchases stay attached to the Auth.js user id.
 */
export async function ensurePurchasesConfigured(appUserId: string): Promise<Purchases> {
  const trimmedId = appUserId.trim();
  if (!trimmedId) {
    throw new Error("A non-empty appUserId is required to configure RevenueCat.");
  }

  if (!Purchases.isConfigured()) {
    return Purchases.configure({
      apiKey: getRevenueCatWebApiKey(),
      appUserId: trimmedId,
    });
  }

  const purchases = Purchases.getSharedInstance();
  if (purchases.getAppUserId() !== trimmedId) {
    await purchases.changeUser(trimmedId);
  }
  return purchases;
}

export function tryGetSharedPurchases(): Purchases | null {
  if (!Purchases.isConfigured()) return null;
  return Purchases.getSharedInstance();
}
