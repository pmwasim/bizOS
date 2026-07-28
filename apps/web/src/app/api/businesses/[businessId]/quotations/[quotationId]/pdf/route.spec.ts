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

describe("quotation PDF proxy route", () => {
  beforeEach(() => {
    apiFetch.mockReset();
  });

  it("returns 401 instead of 500 when the session is missing", async () => {
    apiFetch.mockRejectedValue(new ApiError("Sign in to continue.", 401));

    const response = await GET(new Request("https://bizos.example/api/pdf") as never, {
      params: Promise.resolve({
        businessId: "business-1",
        quotationId: "quotation-1",
      }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Sign in to continue." });
  });

  it("forwards upstream preview failures without wrapping them as 500", async () => {
    apiFetch.mockResolvedValue(
      new Response(JSON.stringify({ detail: "forbidden" }), { status: 403 }),
    );

    const response = await GET(new Request("https://bizos.example/api/pdf") as never, {
      params: Promise.resolve({
        businessId: "business-1",
        quotationId: "quotation-1",
      }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Preview unavailable." });
  });
});
