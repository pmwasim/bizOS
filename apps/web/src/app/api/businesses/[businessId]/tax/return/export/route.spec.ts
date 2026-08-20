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

const params = Promise.resolve({ businessId: "business-1" });

describe("tax export proxy route", () => {
  beforeEach(() => {
    apiFetch.mockReset();
  });

  it("streams the summary export as an attachment, forwarding kind and dropping malformed dates", async () => {
    apiFetch.mockResolvedValue(
      new Response("countryCode,returnName\r\nSA,VAT Return\r\n", {
        status: 200,
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition":
            'attachment; filename="tax-return-summary-SA-2026-01-01_2026-03-31.csv"',
        },
      }),
    );

    const response = await GET(
      new Request(
        "https://bizos.example/api/export?startDate=2026-01-01&endDate=not-a-date&format=csv&kind=summary",
      ),
      { params },
    );

    expect(response.status).toBe(200);
    // Only the well-formed start date is forwarded; the malformed end date is dropped rather than guessed.
    expect(apiFetch).toHaveBeenCalledWith(
      "/businesses/business-1/tax/return/export?startDate=2026-01-01&format=csv&kind=summary",
    );
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="tax-return-summary-SA-2026-01-01_2026-03-31.csv"',
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(response.text()).resolves.toContain("SA,VAT Return");
  });

  it("defaults to the detail kind and csv format when neither is a known value", async () => {
    apiFetch.mockResolvedValue(new Response("ok", { status: 200 }));

    await GET(new Request("https://bizos.example/api/export?kind=bogus&format=xml"), { params });

    expect(apiFetch).toHaveBeenCalledWith(
      "/businesses/business-1/tax/return/export?format=csv&kind=detail",
    );
  });

  it("forwards the json format and summary kind together", async () => {
    apiFetch.mockResolvedValue(new Response("{}", { status: 200 }));

    await GET(new Request("https://bizos.example/api/export?format=json&kind=summary"), { params });

    expect(apiFetch).toHaveBeenCalledWith(
      "/businesses/business-1/tax/return/export?format=json&kind=summary",
    );
  });

  it("passes an upstream failure through without wrapping it as a 500", async () => {
    apiFetch.mockResolvedValue(new Response("nope", { status: 403 }));

    const response = await GET(new Request("https://bizos.example/api/export"), { params });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Export unavailable." });
  });

  it("returns the ApiError status instead of throwing when the session is missing", async () => {
    apiFetch.mockRejectedValue(new ApiError("Sign in to continue.", 401));

    const response = await GET(new Request("https://bizos.example/api/export"), { params });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Sign in to continue." });
  });
});
