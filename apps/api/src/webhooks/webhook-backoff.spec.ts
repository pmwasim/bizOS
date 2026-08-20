import { describe, expect, it } from "vitest";

import {
  backoffDelayMs,
  hasReachedMaxAttempts,
  nextAttemptAt,
  WEBHOOK_BASE_DELAY_MS,
  WEBHOOK_MAX_ATTEMPTS,
  WEBHOOK_MAX_DELAY_MS,
} from "./webhook-backoff.js";

describe("backoffDelayMs", () => {
  it("doubles from the base delay on each successive attempt", () => {
    expect(backoffDelayMs(1)).toBe(WEBHOOK_BASE_DELAY_MS);
    expect(backoffDelayMs(2)).toBe(WEBHOOK_BASE_DELAY_MS * 2);
    expect(backoffDelayMs(3)).toBe(WEBHOOK_BASE_DELAY_MS * 4);
    expect(backoffDelayMs(4)).toBe(WEBHOOK_BASE_DELAY_MS * 8);
  });

  it("increases monotonically and never exceeds the cap", () => {
    let previous = 0;
    for (let attempt = 1; attempt <= WEBHOOK_MAX_ATTEMPTS; attempt += 1) {
      const delay = backoffDelayMs(attempt);
      expect(delay).toBeGreaterThanOrEqual(previous);
      expect(delay).toBeLessThanOrEqual(WEBHOOK_MAX_DELAY_MS);
      previous = delay;
    }
  });

  it("clamps very large attempt counts to the cap without overflowing", () => {
    expect(backoffDelayMs(1000)).toBe(WEBHOOK_MAX_DELAY_MS);
  });
});

describe("nextAttemptAt", () => {
  it("adds the backoff delay to the current time", () => {
    const now = new Date("2026-08-20T00:00:00.000Z");
    expect(nextAttemptAt(1, now).getTime()).toBe(now.getTime() + WEBHOOK_BASE_DELAY_MS);
    expect(nextAttemptAt(2, now).getTime()).toBe(now.getTime() + WEBHOOK_BASE_DELAY_MS * 2);
  });
});

describe("hasReachedMaxAttempts", () => {
  it("is false below the budget and true at or above it", () => {
    expect(hasReachedMaxAttempts(WEBHOOK_MAX_ATTEMPTS - 1)).toBe(false);
    expect(hasReachedMaxAttempts(WEBHOOK_MAX_ATTEMPTS)).toBe(true);
    expect(hasReachedMaxAttempts(WEBHOOK_MAX_ATTEMPTS + 1)).toBe(true);
  });
});
