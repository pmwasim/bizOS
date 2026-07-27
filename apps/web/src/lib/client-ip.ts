import { headers } from "next/headers";

import { BIZO_CLIENT_IP_HEADER } from "./client-ip-header.js";

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
  return { [BIZO_CLIENT_IP_HEADER]: candidate };
}
