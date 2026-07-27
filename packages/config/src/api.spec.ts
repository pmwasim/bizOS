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
      }),
    ).toEqual({
      API_PORT: 4000,
      DATABASE_URL: "postgresql://bizo:test@localhost:5432/bizo",
      INTERNAL_AUTH_SECRET: "test-secret-that-is-at-least-32-characters",
      NODE_ENV: "test",
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
      }),
    ).toThrow();
  });
});
