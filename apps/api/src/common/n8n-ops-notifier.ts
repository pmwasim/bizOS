// Optional n8n ops-plane notifier.
//
// bizOS remains the system of record. When N8N_* webhook URLs are unset this
// module is a no-op. Failures are logged and never thrown to callers.

import { createHmac, timingSafeEqual } from "node:crypto";

import { Logger } from "@nestjs/common";

const NOTIFIER_TIMEOUT_MS = 4_000;

export type OpsEventName =
  | "customization.request.created"
  | "document.delivery.failed"
  | "onboarding.applied"
  | "system_admin.assignment.changed"
  | "system_admin.default_erp.changed"
  | "system_admin.template.status_changed";

export type OpsSeverity = "low" | "medium" | "high" | "critical";

export interface OpsEventPayload {
  event: OpsEventName;
  idempotencyKey: string;
  occurredAt: string;
  tenantId?: string;
  businessId?: string;
  severity: OpsSeverity;
  title: string;
  message: string;
  data: Record<string, unknown>;
}

export interface CustomizationRequestNotificationPayload {
  id: string;
  tenantId: string;
  businessId: string;
  urgency: string;
  status: string;
  currentConfigurationTemplateVersionId: string | null;
  createdAt: string;
}

export interface DocumentDeliveryFailedNotification {
  tenantId: string;
  businessId: string;
  documentType: "quotation" | "invoice" | "statement";
  documentId: string;
  documentNumber?: string;
  deliveryId: string;
  failureReason: string;
}

export interface OnboardingAppliedNotification {
  tenantId?: string;
  businessId: string;
  assignmentId: string;
  templateCode: string;
  templateVersion: string;
}

export interface SystemAdminOpsNotification {
  event: Extract<
    OpsEventName,
    | "system_admin.assignment.changed"
    | "system_admin.default_erp.changed"
    | "system_admin.template.status_changed"
  >;
  actorId: string;
  businessId?: string;
  tenantId?: string;
  reason: string;
  data: Record<string, unknown>;
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

export interface NotifyOpsOptions {
  fetchFn?: typeof fetch;
  logger?: Logger;
}

function webhookUrlFor(event: OpsEventName): string | undefined {
  if (event === "customization.request.created") {
    return process.env.N8N_CUSTOMIZATION_WEBHOOK_URL || process.env.N8N_OPS_WEBHOOK_URL;
  }
  return process.env.N8N_OPS_WEBHOOK_URL;
}

async function postSignedWebhook(
  webhookUrl: string,
  payload: unknown,
  idempotencyKey: string,
  options: NotifyOpsOptions,
  logLabel: string,
): Promise<void> {
  const fetchFn = options.fetchFn ?? fetch;
  const logger = options.logger ?? new Logger("N8nOpsNotifier");
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Idempotency-Key": idempotencyKey,
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
      signal: AbortSignal.timeout(NOTIFIER_TIMEOUT_MS),
    });
    if (!response.ok) {
      logger.warn(`n8n ${logLabel} webhook returned ${response.status}`);
    }
  } catch (error) {
    logger.warn(
      `n8n ${logLabel} webhook failed: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}

export async function notifyOpsEvent(
  payload: OpsEventPayload,
  options: NotifyOpsOptions = {},
): Promise<void> {
  const webhookUrl = webhookUrlFor(payload.event);
  if (!webhookUrl) {
    return;
  }

  await postSignedWebhook(webhookUrl, payload, payload.idempotencyKey, options, payload.event);
}

export async function notifyCustomizationRequestCreated(
  payload: CustomizationRequestNotificationPayload,
  options: NotifyOpsOptions = {},
): Promise<void> {
  const dedicatedUrl = process.env.N8N_CUSTOMIZATION_WEBHOOK_URL;
  if (dedicatedUrl) {
    await postSignedWebhook(dedicatedUrl, payload, payload.id, options, "customization");
    return;
  }

  await notifyOpsEvent(
    {
      event: "customization.request.created",
      idempotencyKey: payload.id,
      occurredAt: payload.createdAt,
      tenantId: payload.tenantId,
      businessId: payload.businessId,
      severity: payload.urgency === "HIGH" ? "high" : "medium",
      title: `[bizOS] Customization request ${payload.id}`,
      message: `Request ${payload.id} for business ${payload.businessId} (tenant ${payload.tenantId}). Urgency: ${payload.urgency}.`,
      data: { ...payload },
    },
    options,
  );
}

export async function notifyDocumentDeliveryFailed(
  input: DocumentDeliveryFailedNotification,
  options: NotifyOpsOptions = {},
): Promise<void> {
  await notifyOpsEvent(
    {
      event: "document.delivery.failed",
      idempotencyKey: input.deliveryId,
      occurredAt: new Date().toISOString(),
      tenantId: input.tenantId,
      businessId: input.businessId,
      severity: "high",
      title: `[bizOS] ${input.documentType} email failed`,
      message: `${input.documentType} ${input.documentNumber ?? input.documentId} could not be emailed (${input.failureReason}).`,
      data: {
        documentType: input.documentType,
        documentId: input.documentId,
        documentNumber: input.documentNumber ?? null,
        deliveryId: input.deliveryId,
        failureReason: input.failureReason,
      },
    },
    options,
  );
}

export async function notifyOnboardingApplied(
  input: OnboardingAppliedNotification,
  options: NotifyOpsOptions = {},
): Promise<void> {
  await notifyOpsEvent(
    {
      event: "onboarding.applied",
      idempotencyKey: input.assignmentId,
      occurredAt: new Date().toISOString(),
      ...(input.tenantId ? { tenantId: input.tenantId } : {}),
      businessId: input.businessId,
      severity: "low",
      title: `[bizOS] Onboarding applied for ${input.businessId}`,
      message: `Business ${input.businessId} applied ${input.templateCode}@${input.templateVersion}.`,
      data: {
        assignmentId: input.assignmentId,
        templateCode: input.templateCode,
        templateVersion: input.templateVersion,
      },
    },
    options,
  );
}

export async function notifySystemAdminOps(
  input: SystemAdminOpsNotification,
  options: NotifyOpsOptions = {},
): Promise<void> {
  const titles: Record<SystemAdminOpsNotification["event"], string> = {
    "system_admin.assignment.changed": `[bizOS] System Admin assignment change`,
    "system_admin.default_erp.changed": `[bizOS] Platform default ERP changed`,
    "system_admin.template.status_changed": `[bizOS] Configuration template status changed`,
  };

  await notifyOpsEvent(
    {
      event: input.event,
      idempotencyKey: `${input.event}:${input.actorId}:${input.data.entityId ?? input.businessId ?? "platform"}:${input.reason}`,
      occurredAt: new Date().toISOString(),
      ...(input.tenantId ? { tenantId: input.tenantId } : {}),
      ...(input.businessId ? { businessId: input.businessId } : {}),
      severity: "medium",
      title: titles[input.event],
      message: `${input.event} by ${input.actorId}. Reason: ${input.reason}.`,
      data: { actorId: input.actorId, ...input.data },
    },
    options,
  );
}
