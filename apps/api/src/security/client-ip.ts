import { isIP } from "node:net";

export const BIZO_CLIENT_IP_HEADER = "x-bizo-client-ip";

export function parseTrustedClientIp(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const candidate = value.trim();
  if (!candidate || candidate.length > 45 || candidate.includes(",")) {
    return undefined;
  }
  return isIP(candidate) === 0 ? undefined : candidate;
}
