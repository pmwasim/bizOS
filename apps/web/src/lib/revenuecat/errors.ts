import { ErrorCode, PurchasesError } from "@revenuecat/purchases-js";

export function isPurchasesError(error: unknown): error is PurchasesError {
  return error instanceof PurchasesError;
}

export function isUserCancelledPurchase(error: unknown): boolean {
  return isPurchasesError(error) && error.errorCode === ErrorCode.UserCancelledError;
}

/** Human-readable message suitable for inline UI; never exposes secrets. */
export function formatPurchasesError(error: unknown): string {
  if (isUserCancelledPurchase(error)) {
    return "Purchase cancelled.";
  }
  if (isPurchasesError(error)) {
    return error.message || "Purchase failed. Please try again.";
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return "Something went wrong with billing. Please try again.";
}
