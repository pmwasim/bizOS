import { describe, expect, it } from "vitest";

import { readApiEnvironment } from "./api.js";

describe("readApiEnvironment", () => {
  it("coerces a valid API port", () => {
    expect(
      readApiEnvironment({
        API_PORT: "4000",
        DATABASE_URL: "postgresql://bizo:test@localhost:5432/bizo",
        INTERNAL_AUTH_SECRET: "test-secret-that-is-at-least-32-characters",
        NODE_ENV: "test",
        SMTP_FROM: "quotes@example.test",
        SMTP_URL: "smtp://localhost:1025",
      }),
    ).toEqual({
      API_PORT: 4000,
      DATABASE_URL: "postgresql://bizo:test@localhost:5432/bizo",
      INTERNAL_AUTH_SECRET: "test-secret-that-is-at-least-32-characters",
      NODE_ENV: "test",
      SMTP_FROM: "quotes@example.test",
      SMTP_URL: "smtp://localhost:1025",
    });
  });

  it("rejects an invalid API port", () => {
    expect(() => readApiEnvironment({ API_PORT: "70000" })).toThrow();
  });

  it("rejects weak internal assertions", () => {
    expect(() =>
      readApiEnvironment({
        DATABASE_URL: "postgresql://bizo:test@localhost:5432/bizo",
        INTERNAL_AUTH_SECRET: "too-short",
        SMTP_FROM: "quotes@example.test",
        SMTP_URL: "smtp://localhost:1025",
      }),
    ).toThrow();
  });

  it("rejects a non-SMTP delivery URL", () => {
    expect(() =>
      readApiEnvironment({
        DATABASE_URL: "postgresql://bizo:test@localhost:5432/bizo",
        INTERNAL_AUTH_SECRET: "test-secret-that-is-at-least-32-characters",
        SMTP_FROM: "quotes@example.test",
        SMTP_URL: "https://example.test",
      }),
    ).toThrow();
  });
});
