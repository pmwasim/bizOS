import { createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

export const BIZO_CLIENT_IP_HEADER = "x-bizo-client-ip";
export const BIZO_CLIENT_IP_SIGNATURE_HEADER = "x-bizo-client-ip-signature";

function isWellFormedIp(value: unknown): value is string {
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
  if (!isWellFormedIp(value) || typeof signature !== "string") {
    return undefined;
  }

  const candidate = value.trim();
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
