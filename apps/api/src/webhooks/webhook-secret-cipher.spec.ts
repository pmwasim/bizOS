import { describe, expect, it } from "vitest";

import {
  decryptWebhookSecret,
  deriveWebhookEncryptionKey,
  encryptWebhookSecret,
  resolveWebhookEncryptionKey,
  secretsEqual,
} from "./webhook-secret-cipher.js";

const key = deriveWebhookEncryptionKey("a".repeat(32));

describe("encryptWebhookSecret / decryptWebhookSecret", () => {
  it("round-trips a signing secret through ciphertext", () => {
    const secret = "whsec_0123456789abcdef";
    const stored = encryptWebhookSecret(secret, key);

    expect(stored.startsWith("v1:")).toBe(true);
    expect(stored).not.toContain(secret);
    expect(decryptWebhookSecret(stored, key)).toBe(secret);
  });

  it("produces distinct ciphertext each time (random IV) but decrypts to the same value", () => {
    const secret = "whsec_repeat";
    const a = encryptWebhookSecret(secret, key);
    const b = encryptWebhookSecret(secret, key);

    expect(a).not.toEqual(b);
    expect(decryptWebhookSecret(a, key)).toBe(secret);
    expect(decryptWebhookSecret(b, key)).toBe(secret);
  });

  it("keeps the stored form within the VARCHAR(255) column budget", () => {
    const stored = encryptWebhookSecret(`whsec_${"f".repeat(64)}`, key);
    expect(stored.length).toBeLessThanOrEqual(255);
  });

  it("fails to decrypt under a different key (authenticated encryption)", () => {
    const stored = encryptWebhookSecret("whsec_secret", key);
    const otherKey = deriveWebhookEncryptionKey("b".repeat(32));

    expect(() => decryptWebhookSecret(stored, otherKey)).toThrow();
  });

  it("rejects tampered ciphertext", () => {
    const stored = encryptWebhookSecret("whsec_secret", key);
    const tampered = `${stored.slice(0, -2)}00`;

    expect(() => decryptWebhookSecret(tampered, key)).toThrow();
  });
});

describe("resolveWebhookEncryptionKey", () => {
  it("derives a 32-byte key from a dedicated env var when present", () => {
    const resolved = resolveWebhookEncryptionKey({
      WEBHOOK_SECRET_ENCRYPTION_KEY: "dedicated-key-material-1234567890",
    } as NodeJS.ProcessEnv);
    expect(resolved).toHaveLength(32);
  });

  it("falls back to INTERNAL_AUTH_SECRET", () => {
    const resolved = resolveWebhookEncryptionKey({
      INTERNAL_AUTH_SECRET: "internal-auth-secret-1234567890ab",
    } as NodeJS.ProcessEnv);
    expect(resolved).toHaveLength(32);
  });

  it("fails closed when no key material is available", () => {
    expect(() => resolveWebhookEncryptionKey({} as NodeJS.ProcessEnv)).toThrow();
  });
});

describe("secretsEqual", () => {
  it("compares equal and unequal secrets", () => {
    expect(secretsEqual("whsec_a", "whsec_a")).toBe(true);
    expect(secretsEqual("whsec_a", "whsec_b")).toBe(false);
    expect(secretsEqual("short", "longer-value")).toBe(false);
  });
});
