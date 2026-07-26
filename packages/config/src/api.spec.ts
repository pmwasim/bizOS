import { describe, expect, it } from "vitest";

import { readApiEnvironment } from "./api.js";

describe("readApiEnvironment", () => {
  it("coerces a valid API port", () => {
    expect(readApiEnvironment({ API_PORT: "4000", NODE_ENV: "test" })).toEqual({
      API_PORT: 4000,
      NODE_ENV: "test",
    });
  });

  it("rejects an invalid API port", () => {
    expect(() => readApiEnvironment({ API_PORT: "70000" })).toThrow();
  });
});
