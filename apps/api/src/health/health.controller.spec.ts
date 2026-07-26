import { describe, expect, it } from "vitest";

import { healthResponseSchema } from "@bizo/contracts/health";

import { HealthController } from "./health.controller.js";

describe("HealthController", () => {
  it("returns a contract-valid health response", () => {
    const result = new HealthController().getHealth();

    expect(healthResponseSchema.parse(result)).toMatchObject({
      service: "api",
      status: "ok",
    });
  });
});
