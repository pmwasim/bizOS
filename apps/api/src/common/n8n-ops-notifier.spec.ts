import { createHmac, timingSafeEqual } from "node:crypto";
import { Logger } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  notifyCustomizationRequestCreated,
  notifyDocumentDeliveryFailed,
  notifyOnboardingApplied,
  notifyOpsEvent,
  notifySystemAdminOps,
  signPayload,
  verifyPayloadSignature,
} from "./n8n-ops-notifier.js";

const CUSTOMIZATION = {
  id: "r0000000-0000-4000-8000-000000000001",
  tenantId: "t0000000-0000-4000-8000-000000000001",
  businessId: "b0000000-0000-4000-8000-000000000001",
  urgency: "HIGH" as const,
  status: "OPEN",
  currentConfigurationTemplateVersionId: "v0000000-0000-4000-8000-000000000001",
  createdAt: "2026-07-28T00:00:00.000Z",
};

describe("n8n ops notifier", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("accepts a valid HMAC signature", () => {
    const body = JSON.stringify(CUSTOMIZATION);
    const secret = "test-webhook-secret";
    expect(verifyPayloadSignature(body, secret, signPayload(body, secret))).toBe(true);
  });

  it("rejects an invalid HMAC signature", () => {
    const body = JSON.stringify(CUSTOMIZATION);
    expect(verifyPayloadSignature(body, "test-webhook-secret", "deadbeef".repeat(8))).toBe(false);
  });

  it("skips silently when no webhook URL is configured", async () => {
    vi.stubEnv("N8N_OPS_WEBHOOK_URL", "");
    vi.stubEnv("N8N_CUSTOMIZATION_WEBHOOK_URL", "");
    const fetchFn = vi.fn();

    await notifyOpsEvent(
      {
        event: "document.delivery.failed",
        idempotencyKey: "d1",
        occurredAt: "2026-08-25T00:00:00.000Z",
        severity: "high",
        title: "failed",
        message: "failed",
        data: {},
      },
      { fetchFn },
    );

    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("posts customization to the dedicated URL in the Phase 11 payload shape", async () => {
    vi.stubEnv("N8N_CUSTOMIZATION_WEBHOOK_URL", "https://n8n.example.test/customization");
    vi.stubEnv("N8N_OPS_WEBHOOK_URL", "https://n8n.example.test/ops");
    vi.stubEnv("N8N_WEBHOOK_SECRET", "test-webhook-secret");
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, status: 200 });

    await notifyCustomizationRequestCreated(CUSTOMIZATION, { fetchFn });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://n8n.example.test/customization");
    const body = String(init.body);
    expect(init.headers).toMatchObject({
      "Content-Type": "application/json",
      "X-Idempotency-Key": CUSTOMIZATION.id,
      "X-Signature": signPayload(body, "test-webhook-secret"),
    });
    expect(JSON.parse(body)).toEqual(CUSTOMIZATION);
  });

  it("posts customization as an ops event when only the ops URL is set", async () => {
    vi.stubEnv("N8N_OPS_WEBHOOK_URL", "https://n8n.example.test/ops");
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, status: 200 });

    await notifyCustomizationRequestCreated(CUSTOMIZATION, { fetchFn });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://n8n.example.test/ops");
    expect(JSON.parse(String(init.body))).toMatchObject({
      event: "customization.request.created",
      idempotencyKey: CUSTOMIZATION.id,
      businessId: CUSTOMIZATION.businessId,
    });
  });

  it("posts document delivery failures to the ops webhook", async () => {
    vi.stubEnv("N8N_OPS_WEBHOOK_URL", "https://n8n.example.test/ops");
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, status: 200 });

    await notifyDocumentDeliveryFailed(
      {
        tenantId: CUSTOMIZATION.tenantId,
        businessId: CUSTOMIZATION.businessId,
        documentType: "invoice",
        documentId: "inv-1",
        documentNumber: "INV-1",
        deliveryId: "del-1",
        failureReason: "ECONNREFUSED",
      },
      { fetchFn },
    );

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(
      JSON.parse(String((fetchFn.mock.calls[0] as [string, RequestInit])[1].body)),
    ).toMatchObject({
      event: "document.delivery.failed",
      idempotencyKey: "del-1",
      data: { documentType: "invoice", failureReason: "ECONNREFUSED" },
    });
  });

  it("posts onboarding and system-admin events", async () => {
    vi.stubEnv("N8N_OPS_WEBHOOK_URL", "https://n8n.example.test/ops");
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, status: 200 });

    await notifyOnboardingApplied(
      {
        businessId: CUSTOMIZATION.businessId,
        assignmentId: "a1",
        templateCode: "default-erp",
        templateVersion: "1.0.0",
      },
      { fetchFn },
    );
    await notifySystemAdminOps(
      {
        event: "system_admin.default_erp.changed",
        actorId: "admin-1",
        reason: "roll forward",
        data: { configurationTemplateVersionId: "v1" },
      },
      { fetchFn },
    );

    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("logs webhook failures without throwing or leaking secrets", async () => {
    vi.stubEnv("N8N_OPS_WEBHOOK_URL", "https://n8n.example.test/ops");
    vi.stubEnv("N8N_WEBHOOK_SECRET", "super-secret-webhook-key");
    const fetchFn = vi.fn().mockRejectedValue(new Error("connection refused"));
    const logger = new Logger("test");
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);

    await expect(
      notifyDocumentDeliveryFailed(
        {
          tenantId: "t1",
          businessId: "b1",
          documentType: "quotation",
          documentId: "q1",
          deliveryId: "d1",
          failureReason: "timeout",
        },
        { fetchFn, logger },
      ),
    ).resolves.toBeUndefined();

    const logged = warn.mock.calls.flat().join(" ");
    expect(logged).toContain("connection refused");
    expect(logged).not.toContain("super-secret-webhook-key");
  });

  it("uses timing-safe comparison for signatures", () => {
    const body = JSON.stringify(CUSTOMIZATION);
    const secret = "test-webhook-secret";
    const valid = signPayload(body, secret);
    expect(timingSafeEqual(Buffer.from(valid), Buffer.from(valid))).toBe(true);
    expect(createHmac("sha256", secret).update(body).digest("hex")).toBe(valid);
  });
});
