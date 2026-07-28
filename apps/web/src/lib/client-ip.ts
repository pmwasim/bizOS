import { createHmac } from "node:crypto";

import { headers } from "next/headers";

import { readWebEnvironment } from "@bizo/config/web";

import { BIZO_CLIENT_IP_HEADER, BIZO_CLIENT_IP_SIGNATURE_HEADER } from "./client-ip-header";

/**
 * The API must not trust a bare x-bizo-client-ip from the public network
 * (BIZ-003). When a signature secret is configured, the BFF proves it observed
 * the client IP by signing "ip.timestamp" with an HMAC. The API only honours
 * the forwarded IP when the signature is present, valid, and fresh; otherwise
 * it falls back to the direct peer address.
 */
export async function clientIpHeaders(): Promise<Record<string, string>> {
  const incoming = await headers();
  const candidate =
    incoming.get("cf-connecting-ip") ??
    incoming.get("x-real-ip") ??
    incoming.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "";
  if (!candidate || candidate.length > 45 || candidate.includes(",") || candidate.includes(" ")) {
    return {};
  }
  const result: Record<string, string> = { [BIZO_CLIENT_IP_HEADER]: candidate };
  const secret = readWebEnvironment(process.env).CLIENT_IP_SIGNATURE_SECRET;
  if (secret) {
    const timestamp = Date.now().toString();
    const signature = createHmac("sha256", secret)
      .update(`${candidate}.${timestamp}`)
      .digest("hex");
    result[BIZO_CLIENT_IP_SIGNATURE_HEADER] = `${timestamp}.${signature}`;
  }
  return result;
}
