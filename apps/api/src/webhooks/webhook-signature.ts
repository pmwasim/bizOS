import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Signing and verification for outbound webhooks.
 *
 * Each delivery is signed with a per-endpoint HMAC-SHA256 over `${timestamp}.${rawBody}`, where the
 * timestamp is the unix-seconds value sent alongside in the `X-Bizo-Timestamp` header. Binding the
 * signature to the timestamp lets a receiver reject replays by enforcing a freshness window on that
 * header before trusting the body. The signature travels as `X-Bizo-Signature: sha256=<hex>`.
 */

/** Prefix on every issued signing secret so a leaked value is recognisable in logs and scanners. */
export const WEBHOOK_SECRET_PREFIX = "whsec_";

export const WEBHOOK_SIGNATURE_HEADER = "X-Bizo-Signature";
export const WEBHOOK_TIMESTAMP_HEADER = "X-Bizo-Timestamp";
export const WEBHOOK_EVENT_HEADER = "X-Bizo-Event";
export const WEBHOOK_DELIVERY_HEADER = "X-Bizo-Delivery";

/** Default receiver skew window (±5 minutes) recommended for `isWebhookTimestampFresh`. */
export const WEBHOOK_DEFAULT_MAX_SKEW_SECONDS = 300;

/** Generates a fresh, full-entropy signing secret. Returned to the caller exactly once, at issue. */
export function generateWebhookSecret(): string {
  return `${WEBHOOK_SECRET_PREFIX}${randomBytes(32).toString("hex")}`;
}

/** Raw HMAC-SHA256 hex digest over the timestamped body. */
export function signWebhookPayload(secret: string, timestamp: string, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

/** The value carried in `X-Bizo-Signature` for a computed digest. */
export function webhookSignatureHeader(secret: string, timestamp: string, body: string): string {
  return `sha256=${signWebhookPayload(secret, timestamp, body)}`;
}

/**
 * Constant-time verification of a presented `sha256=<hex>` header against the secret. Any shape or
 * length mismatch returns false without a timing side channel and without throwing.
 */
export function verifyWebhookSignature(
  secret: string,
  timestamp: string,
  body: string,
  presentedHeader: string,
): boolean {
  const expected = webhookSignatureHeader(secret, timestamp, body);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(presentedHeader, "utf8");
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

/**
 * Receiver-side freshness check for `X-Bizo-Timestamp` (unix seconds as a decimal string).
 * Rejects non-numeric timestamps and values outside ±`maxSkewSeconds` of `now`.
 */
export function isWebhookTimestampFresh(
  timestamp: string,
  now: Date = new Date(),
  maxSkewSeconds: number = WEBHOOK_DEFAULT_MAX_SKEW_SECONDS,
): boolean {
  if (!/^\d{1,16}$/.test(timestamp)) {
    return false;
  }
  if (!Number.isFinite(maxSkewSeconds) || maxSkewSeconds < 0) {
    return false;
  }
  const stamped = Number(timestamp);
  const nowSeconds = Math.floor(now.getTime() / 1000);
  return Math.abs(nowSeconds - stamped) <= maxSkewSeconds;
}
