import { describe, expect, it } from "vitest";

import { readWebEnvironment } from "./web";

describe("readWebEnvironment", () => {
  it("accepts independent session and API assertion secrets", () => {
    expect(
      readWebEnvironment({
        AUTH_SECRET: "session-secret-that-is-at-least-32-characters",
        INTERNAL_AUTH_SECRET: "assertion-secret-that-is-at-least-32-characters",
      }),
    ).toMatchObject({
      API_INTERNAL_URL: "http://localhost:3001/api/v1",
    });
  });

  it("rejects a weak or missing secret", () => {
    expect(() =>
      readWebEnvironment({
        AUTH_SECRET: "too-short",
        INTERNAL_AUTH_SECRET: "assertion-secret-that-is-at-least-32-characters",
      }),
    ).toThrow();
  });
});
