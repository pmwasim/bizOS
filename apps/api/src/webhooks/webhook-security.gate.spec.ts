/**
 * Sprint 6 · TASK-25 — Webhook & Security Penetration Test Gate.
 *
 * Named SEC-* proofs for the public webhook surface. These are hermetic (no DB): they attack the
 * pure crypto / SSRF / secret-handling seams the dispatcher and management API rely on. Real-DB
 * tenant isolation remains covered by `webhooks.service.spec.ts`.
 *
 * Gate rule: every SEC-* below must stay green. A regression here blocks Sprint 6 close-out.
 */
import { describe, expect, it, vi } from "vitest";

import {
  generateWebhookSecret,
  isWebhookTimestampFresh,
  verifyWebhookSignature,
  WEBHOOK_SECRET_PREFIX,
  webhookSignatureHeader,
} from "./webhook-signature.js";
import {
  assertResolvableToPublicAddress,
  assertSafeWebhookUrl,
  isPrivateOrReservedIp,
  UnsafeWebhookUrlError,
} from "./webhook-url.js";
import {
  decryptWebhookSecret,
  deriveWebhookEncryptionKey,
  encryptWebhookSecret,
} from "./webhook-secret-cipher.js";

const GATE_KEY = deriveWebhookEncryptionKey("test-webhook-encryption-key-0123456789abcdef");

describe("TASK-25 webhook security gate", () => {
  describe("SEC-1 SSRF: registration-time URL rejection", () => {
    it("rejects http, localhost, private literals, and credentialed URLs", () => {
      const attacks = [
        "http://example.com/hook",
        "https://localhost/hook",
        "https://127.0.0.1/hook",
        "https://10.0.0.8/hook",
        "https://192.168.1.1/hook",
        "https://169.254.169.254/latest/meta-data/",
        "https://user:pass@example.com/hook",
        "https://metadata.google.internal/computeMetadata/v1/",
      ];
      for (const url of attacks) {
        expect(() => assertSafeWebhookUrl(url), url).toThrow(UnsafeWebhookUrlError);
      }
    });

    it("accepts a normal public https URL", () => {
      expect(() => assertSafeWebhookUrl("https://hooks.example.com/bizos")).not.toThrow();
    });
  });

  describe("SEC-2 SSRF: DNS rebinding at dispatch", () => {
    it("rejects when any resolved address is private (fail closed)", async () => {
      await expect(
        assertResolvableToPublicAddress("https://evil.example/hook", async () => [
          { address: "8.8.8.8", family: 4 },
          { address: "10.0.0.1", family: 4 },
        ]),
      ).rejects.toBeInstanceOf(UnsafeWebhookUrlError);
    });

    it("rejects when DNS resolution fails", async () => {
      await expect(
        assertResolvableToPublicAddress("https://no-such.example/hook", async () => {
          throw new Error("ENOTFOUND");
        }),
      ).rejects.toBeInstanceOf(UnsafeWebhookUrlError);
    });
  });

  describe("SEC-3 signature forgery and replay binding", () => {
    const secret = "whsec_gate_secret_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const timestamp = "1700000123";
    const body = JSON.stringify({ type: "invoice.paid", id: "inv_1" });
    const header = webhookSignatureHeader(secret, timestamp, body);

    it("accepts only the exact secret+timestamp+body triple", () => {
      expect(verifyWebhookSignature(secret, timestamp, body, header)).toBe(true);
      expect(verifyWebhookSignature(`${secret}x`, timestamp, body, header)).toBe(false);
      expect(verifyWebhookSignature(secret, "1700000999", body, header)).toBe(false);
      expect(verifyWebhookSignature(secret, timestamp, `${body} `, header)).toBe(false);
      expect(verifyWebhookSignature(secret, timestamp, body, "sha256=deadbeef")).toBe(false);
    });
  });

  describe("SEC-4 receiver freshness window", () => {
    it("rejects stale, future, and malformed timestamps", () => {
      const now = new Date("2026-08-21T12:00:00.000Z");
      const nowSec = Math.floor(now.getTime() / 1000);
      expect(isWebhookTimestampFresh(String(nowSec), now, 300)).toBe(true);
      expect(isWebhookTimestampFresh(String(nowSec - 301), now, 300)).toBe(false);
      expect(isWebhookTimestampFresh(String(nowSec + 301), now, 300)).toBe(false);
      expect(isWebhookTimestampFresh("not-a-number", now, 300)).toBe(false);
      expect(isWebhookTimestampFresh("-1", now, 300)).toBe(false);
    });
  });

  describe("SEC-5 secret handling", () => {
    it("issues prefixed high-entropy secrets that round-trip through encryption", () => {
      const plaintext = generateWebhookSecret();
      expect(plaintext.startsWith(WEBHOOK_SECRET_PREFIX)).toBe(true);
      expect(plaintext).toMatch(/^whsec_[0-9a-f]{64}$/);

      const sealed = encryptWebhookSecret(plaintext, GATE_KEY);
      expect(sealed).not.toContain(plaintext);
      expect(decryptWebhookSecret(sealed, GATE_KEY)).toBe(plaintext);
    });

    it("does not decrypt with the wrong key material", () => {
      const sealed = encryptWebhookSecret(generateWebhookSecret(), GATE_KEY);
      expect(() =>
        decryptWebhookSecret(sealed, deriveWebhookEncryptionKey("wrong-key-material-0123456789ab")),
      ).toThrow();
    });
  });

  describe("SEC-6 IP classification fail-closed", () => {
    it("flags reserved and link-local ranges used in cloud metadata attacks", () => {
      expect(isPrivateOrReservedIp("169.254.169.254")).toBe(true);
      expect(isPrivateOrReservedIp("127.0.0.1")).toBe(true);
      expect(isPrivateOrReservedIp("0.0.0.0")).toBe(true);
      expect(isPrivateOrReservedIp("not-an-ip")).toBe(true);
      expect(isPrivateOrReservedIp("8.8.8.8")).toBe(false);
    });
  });

  describe("SEC-7 timing-safe verify does not throw on garbage", () => {
    it("returns false for empty and truncated headers", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      expect(verifyWebhookSignature("whsec_x", "1", "{}", "")).toBe(false);
      expect(verifyWebhookSignature("whsec_x", "1", "{}", "sha256=")).toBe(false);
      expect(verifyWebhookSignature("whsec_x", "1", "{}", "md5=abc")).toBe(false);
      spy.mockRestore();
    });
  });
});
