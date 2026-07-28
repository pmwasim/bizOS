// Phase 11 — Optional n8n webhook notifier for customization requests.
//
// After a request is persisted in bizOS, this stub POSTs a signed payload to
// N8N_CUSTOMIZATION_WEBHOOK_URL when configured. Failures are logged and never
// propagate to the caller — n8n is not authoritative for request state.

import { createHmac, timingSafeEqual } from "node:crypto";

import { Logger } from "@nestjs/common";

export interface CustomizationRequestNotificationPayload {
  id: string;
  tenantId: string;
  businessId: string;
  urgency: string;
  status: string;
  currentConfigurationTemplateVersionId: string | null;
  createdAt: string;
}

export function signPayload(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export function verifyPayloadSignature(body: string, secret: string, signature: string): boolean {
  const expected = signPayload(body, secret);
  const expectedBuffer = Buffer.from(expected, "utf8");
  const signatureBuffer = Buffer.from(signature, "utf8");
  if (expectedBuffer.length !== signatureBuffer.length) {
    return false;
  }
  return timingSafeEqual(expectedBuffer, signatureBuffer);
}

export interface NotifyCustomizationRequestOptions {
  fetchFn?: typeof fetch;
  logger?: Logger;
}

export async function notifyCustomizationRequestCreated(
  payload: CustomizationRequestNotificationPayload,
  options: NotifyCustomizationRequestOptions = {},
): Promise<void> {
  const webhookUrl = process.env.N8N_CUSTOMIZATION_WEBHOOK_URL;
  if (!webhookUrl) {
    return;
  }

  const fetchFn = options.fetchFn ?? fetch;
  const logger = options.logger ?? new Logger("N8nCustomizationNotifier");
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Idempotency-Key": payload.id,
  };

  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (secret) {
    headers["X-Signature"] = signPayload(body, secret);
  }

  try {
    const response = await fetchFn(webhookUrl, {
      method: "POST",
      headers,
      body,
    });
    if (!response.ok) {
      logger.warn(`n8n customization webhook returned ${response.status}`);
    }
  } catch (error) {
    logger.warn(
      `n8n customization webhook failed: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
  }
}
