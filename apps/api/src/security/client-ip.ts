import { createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

export const BIZO_CLIENT_IP_HEADER = "x-bizo-client-ip";
export const BIZO_CLIENT_IP_SIGNATURE_HEADER = "x-bizo-client-ip-signature";

const SIGNATURE_MAX_AGE_MS = 60_000;

export function isWellFormedIp(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const candidate = value.trim();
  if (!candidate || candidate.length > 45 || candidate.includes(",")) {
    return false;
  }
  return isIP(candidate) !== 0;
}

/**
 * Accept a forwarded client IP only when it carries a valid signature from the web BFF.
 *
 * Without the signature check, any caller able to reach the API could choose its own rate-limit
 * bucket by rotating this header, which defeats throttling on the public auth routes.
 */
export function parseTrustedClientIp(
  value: unknown,
  signature: unknown,
  secret: string,
): string | undefined {
  if (!isWellFormedIp(value)) {
    return undefined;
  }

  const candidate = value.trim();
  if (typeof signature === "string" && signature.includes(".")) {
    return isTrustedForwardedIp(candidate, signature, secret) ? candidate : undefined;
  }

  if (typeof signature !== "string") {
    return undefined;
  }

  const trimmedSignature = signature.trim();
  if (!/^[0-9a-f]+$/i.test(trimmedSignature)) {
    return undefined;
  }

  const expected = createHmac("sha256", secret).update(candidate).digest();
  const provided = Buffer.from(trimmedSignature, "hex");

  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return undefined;
  }

  return candidate;
}

/**
 * Verify the BFF's HMAC over "ip.timestamp" (BIZ-003). A forwarded client IP is
 * only trustworthy when the caller proves it holds the shared signature secret;
 * otherwise a direct caller could rotate x-bizo-client-ip to evade throttles.
 */
export function isTrustedForwardedIp(
  ip: string,
  signatureHeader: unknown,
  secret: string,
  now: number = Date.now(),
): boolean {
  if (typeof signatureHeader !== "string") {
    return false;
  }
  const separator = signatureHeader.indexOf(".");
  if (separator <= 0) {
    return false;
  }
  const timestamp = signatureHeader.slice(0, separator);
  const provided = signatureHeader.slice(separator + 1);
  if (!/^\d+$/.test(timestamp) || !/^[0-9a-f]{64}$/.test(provided)) {
    return false;
  }
  const age = now - Number(timestamp);
  if (age < 0 || age > SIGNATURE_MAX_AGE_MS) {
    return false;
  }
  const expected = createHmac("sha256", secret).update(`${ip}.${timestamp}`).digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(provided, "utf8");
  return (
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer)
  );
}
