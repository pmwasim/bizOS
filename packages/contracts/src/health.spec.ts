import { describe, expect, it } from "vitest";

import { healthResponseSchema } from "./health.js";

describe("healthResponseSchema", () => {
  it("rejects an invalid timestamp", () => {
    expect(() =>
      healthResponseSchema.parse({
        service: "api",
        status: "ok",
        timestamp: "today",
      }),
    ).toThrow();
  });
});
