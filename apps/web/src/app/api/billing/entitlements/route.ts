import { type BillingEntitlementsResponse } from "@bizo/contracts/billing";

import { apiJson } from "@/lib/api";

export async function GET() {
  try {
    const entitlements = await apiJson<BillingEntitlementsResponse>("/billing/entitlements");
    return Response.json(entitlements);
  } catch (error) {
    const status =
      typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
    const message = error instanceof Error ? error.message : "Unable to load entitlements.";
    return Response.json({ detail: message }, { status: Number.isFinite(status) ? status : 500 });
  }
}
