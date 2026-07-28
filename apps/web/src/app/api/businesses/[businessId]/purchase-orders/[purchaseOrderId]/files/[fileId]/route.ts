import { type NextRequest } from "next/server";

import { ApiError, apiFetch } from "@/lib/api";

export async function GET(
  _request: NextRequest,
  context: {
    params: Promise<{ businessId: string; purchaseOrderId: string; fileId: string }>;
  },
) {
  const { businessId, purchaseOrderId, fileId } = await context.params;
  try {
    const response = await apiFetch(
      `/businesses/${businessId}/purchase-orders/${purchaseOrderId}/files/${fileId}`,
    );
    if (!response.ok) {
      return Response.json({ error: "File unavailable." }, { status: response.status });
    }
    return new Response(await response.arrayBuffer(), {
      status: 200,
      headers: {
        "cache-control": "private, no-store",
        "content-type": response.headers.get("content-type") ?? "application/octet-stream",
        "content-disposition": response.headers.get("content-disposition") ?? "attachment",
      },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
