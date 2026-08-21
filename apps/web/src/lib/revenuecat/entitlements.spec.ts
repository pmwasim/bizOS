import { ErrorCode, PurchasesError, type CustomerInfo } from "@revenuecat/purchases-js";
import { describe, expect, it } from "vitest";

import { QLOUDI_PRO_ENTITLEMENT_ID } from "./constants";
import { hasQloudiPro } from "./entitlements";
import { formatPurchasesError, isUserCancelledPurchase } from "./errors";

function customerWithActive(ids: string[]): CustomerInfo {
  const active: Record<string, { identifier: string }> = {};
  for (const id of ids) {
    active[id] = { identifier: id };
  }
  return {
    entitlements: {
      active,
      all: active,
    },
  } as unknown as CustomerInfo;
}

describe("hasQloudiPro", () => {
  it("returns true when the Qloudi Pro entitlement is active", () => {
    expect(hasQloudiPro(customerWithActive([QLOUDI_PRO_ENTITLEMENT_ID]))).toBe(true);
  });

  it("returns false when the entitlement is missing", () => {
    expect(hasQloudiPro(customerWithActive([]))).toBe(false);
  });
});

describe("formatPurchasesError", () => {
  it("labels user cancellation", () => {
    const error = new PurchasesError(ErrorCode.UserCancelledError, "cancelled");
    expect(isUserCancelledPurchase(error)).toBe(true);
    expect(formatPurchasesError(error)).toBe("Purchase cancelled.");
  });

  it("falls back for unknown errors", () => {
    expect(formatPurchasesError("boom")).toBe(
      "Something went wrong with billing. Please try again.",
    );
  });
});
