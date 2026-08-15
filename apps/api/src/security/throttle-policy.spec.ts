import { afterEach, describe, expect, it } from "vitest";

import { scaledLimit, scaledThrottle, throttleScale } from "./throttle-policy.js";

const originalScale = process.env.THROTTLE_SCALE;
const originalNodeEnv = process.env.NODE_ENV;

function restore(key: "THROTTLE_SCALE" | "NODE_ENV", value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

afterEach(() => {
  restore("THROTTLE_SCALE", originalScale);
  restore("NODE_ENV", originalNodeEnv);
});

describe("throttle policy scaling", () => {
  it("ships the strict limits when THROTTLE_SCALE is unset", () => {
    delete process.env.THROTTLE_SCALE;

    expect(throttleScale()).toBe(1);
    expect(scaledLimit(5)).toBe(5);
    expect(scaledThrottle({ default: { limit: 5, ttl: 60_000 } })).toEqual({
      default: { limit: 5, ttl: 60_000 },
    });
  });

  it("never narrows a limit, whatever the environment says", () => {
    for (const value of ["0", "0.5", "-3", "not-a-number", ""]) {
      process.env.THROTTLE_SCALE = value;
      expect(scaledLimit(5)).toBeGreaterThanOrEqual(5);
    }
  });

  it("ignores the knob entirely in production", () => {
    process.env.NODE_ENV = "production";
    process.env.THROTTLE_SCALE = "40";

    expect(throttleScale()).toBe(1);
    expect(scaledLimit(5)).toBe(5);
  });

  it("widens limits but leaves the window alone when a harness asks for headroom", () => {
    process.env.NODE_ENV = "test";
    process.env.THROTTLE_SCALE = "40";

    expect(
      scaledThrottle({
        default: { limit: 5, ttl: 60_000 },
        perAccount: { limit: 3, ttl: 60_000 },
      }),
    ).toEqual({
      default: { limit: 200, ttl: 60_000 },
      perAccount: { limit: 120, ttl: 60_000 },
    });
  });
});
