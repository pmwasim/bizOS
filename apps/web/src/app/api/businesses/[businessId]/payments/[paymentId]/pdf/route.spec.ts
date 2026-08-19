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

describe("payment receipt PDF proxy route", () => {
  beforeEach(() => {
    apiFetch.mockReset();
  });

  it("returns 401 instead of 500 when the session is missing", async () => {
    apiFetch.mockRejectedValue(new ApiError("Sign in to continue.", 401));

    const response = await GET(new Request("https://bizos.example/api/pdf") as never, {
      params: Promise.resolve({
        businessId: "business-1",
        paymentId: "payment-1",
      }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Sign in to continue." });
  });

  it("forwards upstream receipt failures without wrapping them as 500", async () => {
    apiFetch.mockResolvedValue(
      new Response(JSON.stringify({ detail: "forbidden" }), { status: 403 }),
    );

    const response = await GET(new Request("https://bizos.example/api/pdf") as never, {
      params: Promise.resolve({
        businessId: "business-1",
        paymentId: "payment-1",
      }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Receipt unavailable." });
  });

  it("streams the receipt as an attachment when download is requested", async () => {
    apiFetch.mockResolvedValue(
      new Response(new Uint8Array([37, 80, 68, 70]), {
        status: 200,
        headers: {
          "content-type": "application/pdf",
          "content-disposition": 'inline; filename="receipt-RCPT-1A2B3C4D.pdf"',
        },
      }),
    );

    const response = await GET(
      { nextUrl: new URL("https://bizos.example/api/pdf?download=1") } as never,
      {
        params: Promise.resolve({
          businessId: "business-1",
          paymentId: "payment-1",
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="receipt-RCPT-1A2B3C4D.pdf"',
    );
  });
});
