import { z } from "zod";

/**
 * Domain event types a webhook endpoint can subscribe to.
 *
 * Each value is a `<aggregate>.<event>` string emitted by a domain flow (the same events that are
 * written to the transactional outbox). Endpoints receive a signed HTTP POST for every delivery
 * whose `eventType` appears in their subscription list. The set is a real enum so an unknown event
 * name is rejected at registration rather than silently never matching.
 */
export const WEBHOOK_EVENT_TYPES = [
  "invoice.created",
  "invoice.sent",
  "invoice.paid",
  "quotation.created",
  "quotation.sent",
  "payment.recorded",
  "payment.refunded",
  "payment.reversed",
  "customer.created",
  "customer.updated",
] as const;

export const webhookEventTypeSchema = z.enum(WEBHOOK_EVENT_TYPES);

export type WebhookEventType = z.infer<typeof webhookEventTypeSchema>;

/** Lifecycle state of an endpoint. Mirrors the `WebhookEndpointStatus` enum in the database schema. */
export const webhookEndpointStatusSchema = z.enum(["ACTIVE", "DISABLED"]);

export type WebhookEndpointStatusValue = z.infer<typeof webhookEndpointStatusSchema>;

/**
 * Lifecycle of a single delivery attempt row (the durable retry queue).
 *
 * PENDING → DELIVERING → DELIVERED on success. A failed attempt returns to FAILED with a scheduled
 * `nextAttemptAt`; once the attempt budget is exhausted the row moves to the terminal DEAD state
 * (dead-letter). Mirrors the `WebhookDeliveryStatus` enum in the database schema.
 */
export const webhookDeliveryStatusSchema = z.enum([
  "PENDING",
  "DELIVERING",
  "DELIVERED",
  "FAILED",
  "DEAD",
]);

export type WebhookDeliveryStatusValue = z.infer<typeof webhookDeliveryStatusSchema>;

/**
 * A webhook target URL. Structural validation only — scheme and length are checked here; the
 * SSRF host/IP checks (localhost, RFC1918, link-local, DNS resolution) are enforced server-side at
 * registration and again, fail-closed, before every dispatch.
 *
 * HTTPS is required: payloads and their signatures must not traverse the network in cleartext, and
 * private/local targets (the only plausible http use) are already rejected by the SSRF checks. The
 * 512-char cap matches the `webhook_subscriptions.url` column so a valid-looking request can never
 * fail at the database layer.
 */
export const webhookUrlSchema = z
  .url()
  .max(512)
  .refine((value) => value.startsWith("https://"), "The webhook URL must use https://.");

export const createWebhookEndpointRequestSchema = z.strictObject({
  url: webhookUrlSchema,
  events: z.array(webhookEventTypeSchema).min(1).max(WEBHOOK_EVENT_TYPES.length),
});

export type CreateWebhookEndpointRequest = z.infer<typeof createWebhookEndpointRequestSchema>;

export const updateWebhookEndpointRequestSchema = z
  .strictObject({
    url: webhookUrlSchema.optional(),
    events: z.array(webhookEventTypeSchema).min(1).max(WEBHOOK_EVENT_TYPES.length).optional(),
    status: webhookEndpointStatusSchema.optional(),
  })
  .refine(
    (value) => value.url !== undefined || value.events !== undefined || value.status !== undefined,
    "Provide at least one field to update.",
  );

export type UpdateWebhookEndpointRequest = z.infer<typeof updateWebhookEndpointRequestSchema>;

/** Metadata for an endpoint. Never carries the signing secret — that is returned only at issue. */
export const webhookEndpointSchema = z.strictObject({
  id: z.uuid(),
  url: z.string(),
  events: z.array(webhookEventTypeSchema),
  status: webhookEndpointStatusSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type WebhookEndpoint = z.infer<typeof webhookEndpointSchema>;

/**
 * The one-time response returned when an endpoint is created or its secret rotated. The `secret`
 * field is the only moment the plaintext signing secret is available; it is stored encrypted and
 * cannot be retrieved again.
 */
export const issuedWebhookEndpointSchema = webhookEndpointSchema.extend({
  secret: z.string(),
});

export type IssuedWebhookEndpoint = z.infer<typeof issuedWebhookEndpointSchema>;

/** A single delivery attempt record, exposed for observability of the retry queue. */
export const webhookDeliverySchema = z.strictObject({
  id: z.uuid(),
  endpointId: z.uuid(),
  eventType: webhookEventTypeSchema,
  status: webhookDeliveryStatusSchema,
  attemptCount: z.number().int().nonnegative(),
  nextAttemptAt: z.iso.datetime().nullable(),
  responseStatusCode: z.number().int().nullable(),
  lastError: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type WebhookDelivery = z.infer<typeof webhookDeliverySchema>;
