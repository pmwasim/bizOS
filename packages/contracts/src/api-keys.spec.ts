import { describe, expect, it } from "vitest";

import { apiKeySchema, createApiKeyRequestSchema, issuedApiKeySchema } from "./api-keys.js";

describe("createApiKeyRequestSchema", () => {
  it("accepts a request with known scopes and defaults expiresAt to null", () => {
    const parsed = createApiKeyRequestSchema.parse({
      name: "CI integration",
      scopes: ["invoices:read", "payments:read"],
    });

    expect(parsed.expiresAt).toBeNull();
    expect(parsed.scopes).toEqual(["invoices:read", "payments:read"]);
  });

  it("rejects an unknown scope", () => {
    expect(() =>
      createApiKeyRequestSchema.parse({
        name: "bad",
        scopes: ["invoices:delete"],
      }),
    ).toThrow();
  });

  it("rejects an empty scope list", () => {
    expect(() => createApiKeyRequestSchema.parse({ name: "no-scopes", scopes: [] })).toThrow();
  });

  it("rejects unknown keys (strict object)", () => {
    expect(() =>
      createApiKeyRequestSchema.parse({
        name: "x",
        scopes: ["invoices:read"],
        secret: "leaked",
      }),
    ).toThrow();
  });
});

describe("apiKeySchema", () => {
  it("does not permit a secret field on the metadata shape", () => {
    expect(() =>
      apiKeySchema.parse({
        id: "6f1b1b2e-0000-4000-8000-000000000001",
        name: "k",
        prefix: "bzo_abcd1234",
        scopes: ["invoices:read"],
        status: "ACTIVE",
        lastUsedAt: null,
        expiresAt: null,
        createdAt: "2026-08-20T00:00:00.000Z",
        secret: "should-not-be-here",
      }),
    ).toThrow();
  });

  it("accepts the issued shape that carries the one-time secret", () => {
    const parsed = issuedApiKeySchema.parse({
      id: "6f1b1b2e-0000-4000-8000-000000000001",
      name: "k",
      prefix: "bzo_abcd1234",
      scopes: ["invoices:read"],
      status: "ACTIVE",
      lastUsedAt: null,
      expiresAt: null,
      createdAt: "2026-08-20T00:00:00.000Z",
      secret: "bzo_abcd1234deadbeef",
    });

    expect(parsed.secret).toContain("bzo_");
  });
});
