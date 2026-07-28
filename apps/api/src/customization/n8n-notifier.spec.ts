import { createHmac, timingSafeEqual } from "node:crypto";
import { Logger } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  notifyCustomizationRequestCreated,
  signPayload,
  verifyPayloadSignature,
} from "./n8n-notifier.js";

const PAYLOAD = {
  id: "r0000000-0000-4000-8000-000000000001",
  tenantId: "t0000000-0000-4000-8000-000000000001",
  businessId: "b0000000-0000-4000-8000-000000000001",
  urgency: "HIGH",
  status: "OPEN",
  currentConfigurationTemplateVersionId: "v0000000-0000-4000-8000-000000000001",
  createdAt: "2026-07-28T00:00:00.000Z",
};

describe("n8n customization notifier", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("accepts a valid HMAC signature", () => {
    const body = JSON.stringify(PAYLOAD);
    const secret = "test-webhook-secret";
    const signature = signPayload(body, secret);

    expect(verifyPayloadSignature(body, secret, signature)).toBe(true);
  });

  it("rejects an invalid HMAC signature", () => {
    const body = JSON.stringify(PAYLOAD);
    const secret = "test-webhook-secret";

    expect(verifyPayloadSignature(body, secret, "deadbeef".repeat(8))).toBe(false);
  });

  it("skips silently when the webhook URL is missing", async () => {
    vi.stubEnv("N8N_CUSTOMIZATION_WEBHOOK_URL", "");
    const fetchFn = vi.fn();

    await notifyCustomizationRequestCreated(PAYLOAD, { fetchFn });

    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("posts a signed payload with an idempotency key when configured", async () => {
    vi.stubEnv("N8N_CUSTOMIZATION_WEBHOOK_URL", "https://n8n.example.test/customization");
    vi.stubEnv("N8N_WEBHOOK_SECRET", "test-webhook-secret");
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, status: 200 });

    await notifyCustomizationRequestCreated(PAYLOAD, { fetchFn });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://n8n.example.test/customization");
    const body = String(init.body);
    expect(init.headers).toMatchObject({
      "Content-Type": "application/json",
      "X-Idempotency-Key": PAYLOAD.id,
      "X-Signature": signPayload(body, "test-webhook-secret"),
    });
    expect(body).toBe(JSON.stringify(PAYLOAD));
  });

  it("logs webhook failures without throwing", async () => {
    vi.stubEnv("N8N_CUSTOMIZATION_WEBHOOK_URL", "https://n8n.example.test/customization");
    const fetchFn = vi.fn().mockRejectedValue(new Error("network down"));
    const logger = new Logger("test");
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);

    await expect(
      notifyCustomizationRequestCreated(PAYLOAD, { fetchFn, logger }),
    ).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("network down"));
  });

  it("logs non-ok HTTP responses without throwing", async () => {
    vi.stubEnv("N8N_CUSTOMIZATION_WEBHOOK_URL", "https://n8n.example.test/customization");
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    const logger = new Logger("test");
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);

    await expect(
      notifyCustomizationRequestCreated(PAYLOAD, { fetchFn, logger }),
    ).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith("n8n customization webhook returned 503");
  });

  it("reuses the request id as a stable idempotency key on repeated posts", async () => {
    vi.stubEnv("N8N_CUSTOMIZATION_WEBHOOK_URL", "https://n8n.example.test/customization");
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, status: 200 });

    await notifyCustomizationRequestCreated(PAYLOAD, { fetchFn });
    await notifyCustomizationRequestCreated(PAYLOAD, { fetchFn });

    expect(fetchFn).toHaveBeenCalledTimes(2);
    for (const [, init] of fetchFn.mock.calls as Array<[string, RequestInit]>) {
      expect(init.headers).toMatchObject({ "X-Idempotency-Key": PAYLOAD.id });
    }
  });

  it("does not log webhook secrets on failure", async () => {
    vi.stubEnv("N8N_CUSTOMIZATION_WEBHOOK_URL", "https://n8n.example.test/customization");
    vi.stubEnv("N8N_WEBHOOK_SECRET", "super-secret-webhook-key");
    const fetchFn = vi.fn().mockRejectedValue(new Error("connection refused"));
    const logger = new Logger("test");
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);

    await notifyCustomizationRequestCreated(PAYLOAD, { fetchFn, logger });

    const logged = warn.mock.calls.flat().join(" ");
    expect(logged).not.toContain("super-secret-webhook-key");
    expect(logged).toContain("connection refused");
  });

  it("uses timing-safe comparison for signatures", () => {
    const body = JSON.stringify(PAYLOAD);
    const secret = "test-webhook-secret";
    const valid = signPayload(body, secret);
    const almostValid = `${valid.slice(0, -1)}0`;

    expect(timingSafeEqual(Buffer.from(valid), Buffer.from(valid))).toBe(true);
    expect(
      verifyPayloadSignature(
        body,
        secret,
        almostValid.length === valid.length ? almostValid : valid,
      ),
    ).toBe(almostValid.length === valid.length ? false : true);
    expect(createHmac("sha256", secret).update(body).digest("hex")).toBe(valid);
  });
});
