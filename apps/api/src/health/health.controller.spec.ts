import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { healthResponseSchema } from "@bizo/contracts/health";

import { HealthController } from "./health.controller.js";

const baseEnvironment = {
  DATABASE_URL: "postgresql://bizo:test@localhost:5432/bizo",
  INTERNAL_AUTH_SECRET: "test-internal-auth-secret-at-least-32-bytes",
  SMTP_FROM: "quotes@example.test",
  SMTP_URL: "smtp://localhost:1025",
};

describe("HealthController", () => {
  const originalEnvironment = { ...process.env };

  beforeEach(() => {
    Object.assign(process.env, baseEnvironment);
    delete process.env.GIT_SHA;
    delete process.env.BUILD_TIME;
  });

  afterEach(() => {
    process.env = { ...originalEnvironment };
  });

  it("returns a contract-valid health response", () => {
    const result = new HealthController().getHealth();

    expect(healthResponseSchema.parse(result)).toMatchObject({
      service: "api",
      status: "ok",
    });
  });

  it("omits version fields when no build metadata is present", () => {
    const result = new HealthController().getHealth();

    expect(result.gitSha).toBeUndefined();
    expect(result.buildTime).toBeUndefined();
  });

  it("exposes build metadata when GIT_SHA and BUILD_TIME are set", () => {
    process.env.GIT_SHA = "1234567890abcdef1234567890abcdef12345678";
    process.env.BUILD_TIME = "2026-07-28T00:00:00.000Z";

    const result = new HealthController().getHealth();

    expect(healthResponseSchema.parse(result)).toMatchObject({
      buildTime: "2026-07-28T00:00:00.000Z",
      gitSha: "1234567890abcdef1234567890abcdef12345678",
    });
  });
});
