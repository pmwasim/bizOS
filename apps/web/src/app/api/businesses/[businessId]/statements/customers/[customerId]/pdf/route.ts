import { ApiError, apiFetch } from "@/lib/api";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Streams a customer statement PDF through the BFF so the browser request carries the session.
 *
 * The reporting period is forwarded so the downloaded PDF matches what the sender is viewing; only
 * well-formed dates are passed on, and anything else is dropped rather than guessed at.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ businessId: string; customerId: string }> },
) {
  const { businessId, customerId } = await context.params;
  const requestUrl = new URL(request.url);

  const forwarded = new URLSearchParams();
  for (const key of ["startDate", "endDate"] as const) {
    const value = requestUrl.searchParams.get(key);
    if (value && DATE_ONLY.test(value)) forwarded.set(key, value);
  }
  const suffix = forwarded.size ? `?${forwarded.toString()}` : "";

  try {
    const response = await apiFetch(
      `/businesses/${businessId}/statements/customers/${customerId}/pdf${suffix}`,
    );
    if (!response.ok) {
      return Response.json({ error: "Preview unavailable." }, { status: response.status });
    }
    const disposition = response.headers.get("content-disposition") ?? "inline";
    return new Response(await response.arrayBuffer(), {
      status: 200,
      headers: {
        "cache-control": "private, no-store",
        "content-type": "application/pdf",
        "content-disposition": requestUrl.searchParams.has("download")
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
