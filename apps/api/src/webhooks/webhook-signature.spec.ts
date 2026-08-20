import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  generateWebhookSecret,
  signWebhookPayload,
  verifyWebhookSignature,
  WEBHOOK_SECRET_PREFIX,
  webhookSignatureHeader,
} from "./webhook-signature.js";

describe("generateWebhookSecret", () => {
  it("issues a prefixed, high-entropy, unique secret", () => {
    const a = generateWebhookSecret();
    const b = generateWebhookSecret();

    expect(a.startsWith(WEBHOOK_SECRET_PREFIX)).toBe(true);
    expect(a).toMatch(/^whsec_[0-9a-f]{64}$/);
    expect(a).not.toEqual(b);
  });
});

describe("signWebhookPayload / webhookSignatureHeader", () => {
  it("computes the HMAC-SHA256 over `${timestamp}.${body}`", () => {
    const secret = "whsec_test";
    const timestamp = "1700000000";
    const body = JSON.stringify({ hello: "world" });

    const expected = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");

    expect(signWebhookPayload(secret, timestamp, body)).toBe(expected);
    expect(webhookSignatureHeader(secret, timestamp, body)).toBe(`sha256=${expected}`);
  });

  it("changes the signature when the timestamp changes (replay binding)", () => {
    const secret = "whsec_test";
    const body = "{}";

    expect(signWebhookPayload(secret, "1", body)).not.toEqual(
      signWebhookPayload(secret, "2", body),
    );
  });
});

describe("verifyWebhookSignature", () => {
  const secret = "whsec_verify";
  const timestamp = "1700000123";
  const body = JSON.stringify({ event: "invoice.paid" });
  const header = webhookSignatureHeader(secret, timestamp, body);

  it("accepts a signature produced with the same secret, timestamp, and body", () => {
    expect(verifyWebhookSignature(secret, timestamp, body, header)).toBe(true);
  });

  it("rejects a signature made with the wrong secret", () => {
    expect(verifyWebhookSignature("whsec_wrong", timestamp, body, header)).toBe(false);
  });

  it("rejects a tampered body", () => {
    expect(verifyWebhookSignature(secret, timestamp, `${body} `, header)).toBe(false);
  });

  it("rejects a reused signature under a different timestamp", () => {
    expect(verifyWebhookSignature(secret, "1700000999", body, header)).toBe(false);
  });

  it("rejects a malformed header without throwing", () => {
    expect(verifyWebhookSignature(secret, timestamp, body, "not-a-signature")).toBe(false);
    expect(verifyWebhookSignature(secret, timestamp, body, "")).toBe(false);
  });
});
