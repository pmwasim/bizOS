import { createHmac } from "node:crypto";

import { headers } from "next/headers";

import { readWebEnvironment } from "@bizo/config/web";

import { BIZO_CLIENT_IP_HEADER, BIZO_CLIENT_IP_SIGNATURE_HEADER } from "./client-ip-header";

/**
 * Forward the caller's IP to the API for rate-limit accounting.
 *
 * The value is signed with the shared internal secret. The API only honours a forwarded IP when
 * the signature verifies, so a caller that reaches the API directly cannot choose its own throttle
 * bucket. Replaying a captured signature only re-asserts the IP it was issued for, which is the
 * bucket that caller already belongs to.
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

  const signature = createHmac("sha256", readWebEnvironment(process.env).INTERNAL_AUTH_SECRET)
    .update(candidate)
    .digest("hex");

  return {
    [BIZO_CLIENT_IP_HEADER]: candidate,
    [BIZO_CLIENT_IP_SIGNATURE_HEADER]: signature,
  };
}
