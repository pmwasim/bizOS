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
      APP_BASE_URL: "http://localhost:3000",
      DATABASE_URL: "postgresql://bizo:test@localhost:5432/bizo",
      INTERNAL_AUTH_SECRET: "test-secret-that-is-at-least-32-characters",
      NODE_ENV: "test",
      SMTP_FROM: "quotes@example.test",
      SMTP_URL: "smtp://localhost:1025",
      THROTTLE_SCALE: 1,
    });
  });

  it("defaults THROTTLE_SCALE to the strict limits", () => {
    expect(
      readApiEnvironment({
        DATABASE_URL: "postgresql://bizo:test@localhost:5432/bizo",
        INTERNAL_AUTH_SECRET: "test-secret-that-is-at-least-32-characters",
        NODE_ENV: "test",
        SMTP_FROM: "quotes@example.test",
        SMTP_URL: "smtp://localhost:1025",
      }).THROTTLE_SCALE,
    ).toBe(1);
  });

  it("refuses a widened throttle in production", () => {
    expect(() =>
      readApiEnvironment({
        DATABASE_URL: "postgresql://bizo:test@localhost:5432/bizo",
        INTERNAL_AUTH_SECRET: "test-secret-that-is-at-least-32-characters",
        NODE_ENV: "production",
        SMTP_FROM: "quotes@example.test",
        SMTP_URL: "smtps://localhost:465",
        THROTTLE_SCALE: "40",
      }),
    ).toThrow(/THROTTLE_SCALE must be 1 in production/);
  });

  it("accepts a widened throttle outside production", () => {
    expect(
      readApiEnvironment({
        DATABASE_URL: "postgresql://bizo:test@localhost:5432/bizo",
        INTERNAL_AUTH_SECRET: "test-secret-that-is-at-least-32-characters",
        NODE_ENV: "test",
        SMTP_FROM: "quotes@example.test",
        SMTP_URL: "smtp://localhost:1025",
        THROTTLE_SCALE: "40",
      }).THROTTLE_SCALE,
    ).toBe(40);
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

  it("accepts a complete Frappe connection", () => {
    expect(
      readApiEnvironment({
        DATABASE_URL: "postgresql://bizo:test@localhost:5432/bizo",
        FRAPPE_API_KEY: "api-key",
        FRAPPE_API_SECRET: "api-secret",
        FRAPPE_BASE_URL: "http://localhost:8080",
        INTERNAL_AUTH_SECRET: "test-secret-that-is-at-least-32-characters",
        SMTP_FROM: "quotes@example.test",
        SMTP_URL: "smtp://localhost:1025",
      }),
    ).toMatchObject({ FRAPPE_BASE_URL: "http://localhost:8080" });
  });

  it("rejects a partial Frappe connection", () => {
    expect(() =>
      readApiEnvironment({
        DATABASE_URL: "postgresql://bizo:test@localhost:5432/bizo",
        FRAPPE_BASE_URL: "http://localhost:8080",
        INTERNAL_AUTH_SECRET: "test-secret-that-is-at-least-32-characters",
        SMTP_FROM: "quotes@example.test",
        SMTP_URL: "smtp://localhost:1025",
      }),
    ).toThrow();
  });

  it("accepts a complete keep-warm configuration", () => {
    expect(
      readApiEnvironment({
        DATABASE_URL: "postgresql://bizo:test@localhost:5432/bizo",
        INTERNAL_AUTH_SECRET: "test-secret-that-is-at-least-32-characters",
        KEEP_WARM_SECRET: "wake-secret-long-enough",
        KEEP_WARM_URL: "https://bizos-health.example.workers.dev/wake",
        SMTP_FROM: "quotes@example.test",
        SMTP_URL: "smtp://localhost:1025",
      }),
    ).toMatchObject({ KEEP_WARM_URL: "https://bizos-health.example.workers.dev/wake" });
  });

  it("rejects a keep-warm URL without its secret", () => {
    expect(() =>
      readApiEnvironment({
        DATABASE_URL: "postgresql://bizo:test@localhost:5432/bizo",
        INTERNAL_AUTH_SECRET: "test-secret-that-is-at-least-32-characters",
        KEEP_WARM_URL: "https://bizos-health.example.workers.dev/wake",
        SMTP_FROM: "quotes@example.test",
        SMTP_URL: "smtp://localhost:1025",
      }),
    ).toThrow();
  });

  it("rejects a plaintext keep-warm URL in production", () => {
    expect(() =>
      readApiEnvironment({
        DATABASE_URL: "postgresql://bizo:test@localhost:5432/bizo",
        INTERNAL_AUTH_SECRET: "test-secret-that-is-at-least-32-characters",
        KEEP_WARM_SECRET: "wake-secret-long-enough",
        KEEP_WARM_URL: "http://bizos-health.example.workers.dev/wake",
        NODE_ENV: "production",
        SMTP_FROM: "quotes@example.test",
        SMTP_URL: "smtp://localhost:1025",
      }),
    ).toThrow();
  });

  it("accepts an optional RevenueCat API key", () => {
    expect(
      readApiEnvironment({
        DATABASE_URL: "postgresql://bizo:test@localhost:5432/bizo",
        INTERNAL_AUTH_SECRET: "test-secret-that-is-at-least-32-characters",
        NODE_ENV: "test",
        REVENUECAT_API_KEY: "test_or_sk_key_value",
        SMTP_FROM: "quotes@example.test",
        SMTP_URL: "smtp://localhost:1025",
      }).REVENUECAT_API_KEY,
    ).toBe("test_or_sk_key_value");
  });
});
