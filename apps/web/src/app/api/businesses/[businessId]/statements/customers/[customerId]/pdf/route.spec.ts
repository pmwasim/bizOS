import { beforeEach, describe, expect, it, vi } from "vitest";

const { ApiError, apiFetch } = vi.hoisted(() => {
  class ApiError extends Error {
    constructor(
      message: string,
      readonly status: number,
    ) {
      super(message);
    }
  }

  return {
    ApiError,
    apiFetch: vi.fn(),
  };
});

vi.mock("@/lib/api", () => ({
  ApiError,
  apiFetch,
}));

import { GET } from "./route";

const params = Promise.resolve({ businessId: "business-1", customerId: "customer-1" });

describe("statement PDF proxy route", () => {
  beforeEach(() => {
    apiFetch.mockReset();
  });

  it("returns 401 instead of 500 when the session is missing", async () => {
    apiFetch.mockRejectedValue(new ApiError("Sign in to continue.", 401));

    const response = await GET(new Request("https://bizos.example/api/pdf"), {
      params: Promise.resolve({ businessId: "business-1", customerId: "customer-1" }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Sign in to continue." });
  });

  it("forwards upstream preview failures without wrapping them as 500", async () => {
    apiFetch.mockResolvedValue(
      new Response(JSON.stringify({ detail: "forbidden" }), { status: 403 }),
    );

    const response = await GET(new Request("https://bizos.example/api/pdf"), {
      params: Promise.resolve({ businessId: "business-1", customerId: "customer-1" }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Preview unavailable." });
  });

  it("forwards only well-formed period dates and marks a download as an attachment", async () => {
    apiFetch.mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-disposition": 'inline; filename="statement-2026-07-31.pdf"' },
      }),
    );

    const response = await GET(
      new Request(
        "https://bizos.example/api/pdf?startDate=2026-07-01&endDate=not-a-date&download=1",
      ),
      { params },
    );

    expect(response.status).toBe(200);
    expect(apiFetch).toHaveBeenCalledWith(
      "/businesses/business-1/statements/customers/customer-1/pdf?startDate=2026-07-01",
    );
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="statement-2026-07-31.pdf"',
    );
  });
});
