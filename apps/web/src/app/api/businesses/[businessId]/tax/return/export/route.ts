import { ApiError, apiFetch } from "@/lib/api";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Streams the tax-return audit export (CSV or JSON) through the BFF so the request carries the
 * session.
 *
 * The period and format are forwarded; only well-formed dates and a known format are passed on, and
 * anything else is dropped rather than guessed at. The API sends the file as an attachment, and the
 * Content-Disposition it chose (which names the file by country and period) is passed straight
 * through.
 */
export async function GET(request: Request, context: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await context.params;
  const requestUrl = new URL(request.url);

  const forwarded = new URLSearchParams();
  for (const key of ["startDate", "endDate"] as const) {
    const value = requestUrl.searchParams.get(key);
    if (value && DATE_ONLY.test(value)) forwarded.set(key, value);
  }
  const format = requestUrl.searchParams.get("format") === "json" ? "json" : "csv";
  forwarded.set("format", format);

  try {
    const response = await apiFetch(
      `/businesses/${businessId}/tax/return/export?${forwarded.toString()}`,
    );
    if (!response.ok) {
      return Response.json({ error: "Export unavailable." }, { status: response.status });
    }
    const contentType =
      response.headers.get("content-type") ?? (format === "json" ? "application/json" : "text/csv");
    const disposition = response.headers.get("content-disposition") ?? "attachment";
    return new Response(await response.arrayBuffer(), {
      status: 200,
      headers: {
        "cache-control": "private, no-store",
        "content-type": contentType,
        "content-disposition": disposition,
      },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
