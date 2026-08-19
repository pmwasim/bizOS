import { type NextRequest } from "next/server";

import { ApiError, apiFetch } from "@/lib/api";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; paymentId: string }> },
) {
  const { businessId, paymentId } = await context.params;
  try {
    const response = await apiFetch(`/businesses/${businessId}/payments/${paymentId}/pdf`);
    if (!response.ok) {
      return Response.json({ error: "Receipt unavailable." }, { status: response.status });
    }
    const disposition = response.headers.get("content-disposition") ?? "inline";
    return new Response(await response.arrayBuffer(), {
      status: 200,
      headers: {
        "cache-control": "private, no-store",
        "content-type": "application/pdf",
        "content-disposition": request.nextUrl.searchParams.has("download")
          ? disposition.replace(/^inline/, "attachment")
          : disposition,
      },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
