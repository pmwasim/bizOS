import { type NextRequest } from "next/server";

import { apiFetch } from "@/lib/api";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; quotationId: string }> },
) {
  const { businessId, quotationId } = await context.params;
  const response = await apiFetch(`/businesses/${businessId}/quotations/${quotationId}/pdf`);
  if (!response.ok) {
    return Response.json({ error: "Preview unavailable." }, { status: response.status });
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
}
