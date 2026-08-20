import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

/**
 * SSRF protection for webhook target URLs.
 *
 * Two layers, both fail-closed:
 *  - `assertSafeWebhookUrl` runs synchronous structural checks (scheme, embedded credentials,
 *    literal IP or obvious-internal hostname) and is used at registration and again before every
 *    dispatch.
 *  - `assertResolvableToPublicAddress` additionally resolves the hostname and rejects the request if
 *    ANY resolved address is private, loopback, link-local, or otherwise reserved. This closes the
 *    DNS-rebinding gap where a public-looking name resolves to an internal address, and runs
 *    immediately before the outbound request in the dispatcher.
 */

export class UnsafeWebhookUrlError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "UnsafeWebhookUrlError";
  }
}

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/** Hostnames that always denote a local or internal target regardless of DNS. */
const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".home.arpa"];

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) {
    return null;
  }
  let value = 0;
  for (const part of parts) {
    const octet = Number(part);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) {
      return null;
    }
    value = value * 256 + octet;
  }
  return value >>> 0;
}

function isPrivateIpv4(ip: string): boolean {
  const value = ipv4ToInt(ip);
  if (value === null) {
    return true; // Unparseable: fail closed.
  }
  const inRange = (base: string, maskBits: number): boolean => {
    const baseValue = ipv4ToInt(base);
    if (baseValue === null) {
      return false;
    }
    const mask = maskBits === 0 ? 0 : (0xffffffff << (32 - maskBits)) >>> 0;
    return (value & mask) === (baseValue & mask);
  };
  return (
    inRange("0.0.0.0", 8) || // "this" network
    inRange("10.0.0.0", 8) || // RFC1918
    inRange("100.64.0.0", 10) || // CGNAT
    inRange("127.0.0.0", 8) || // loopback
    inRange("169.254.0.0", 16) || // link-local
    inRange("172.16.0.0", 12) || // RFC1918
    inRange("192.0.0.0", 24) || // IETF protocol assignments
    inRange("192.0.2.0", 24) || // TEST-NET-1
    inRange("192.168.0.0", 16) || // RFC1918
    inRange("198.18.0.0", 15) || // benchmarking
    inRange("198.51.100.0", 24) || // TEST-NET-2
    inRange("203.0.113.0", 24) || // TEST-NET-3
    inRange("224.0.0.0", 4) || // multicast
    inRange("240.0.0.0", 4) // reserved / broadcast
  );
}

function normaliseIpv6(ip: string): string {
  // Strip an IPv6 zone id and lower-case for prefix comparison.
  return ip.split("%")[0]!.toLowerCase();
}

function isPrivateIpv6(rawIp: string): boolean {
  const ip = normaliseIpv6(rawIp);
  if (ip === "::" || ip === "::1") {
    return true; // unspecified / loopback
  }
  // IPv4-mapped (::ffff:a.b.c.d) — evaluate the embedded IPv4.
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) {
    return isPrivateIpv4(mapped[1]!);
  }
  return (
    ip.startsWith("fc") || // unique local fc00::/7
    ip.startsWith("fd") ||
    ip.startsWith("fe8") || // link-local fe80::/10
    ip.startsWith("fe9") ||
    ip.startsWith("fea") ||
    ip.startsWith("feb")
  );
}

/** Whether a literal IP address string is private, loopback, link-local, or otherwise reserved. */
export function isPrivateOrReservedIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) {
    return isPrivateIpv4(ip);
  }
  if (kind === 6) {
    return isPrivateIpv6(ip);
  }
  return true; // Not a valid IP: fail closed.
}

/**
 * Structural, synchronous safety checks. Returns the parsed URL on success; throws
 * {@link UnsafeWebhookUrlError} otherwise.
 */
export function assertSafeWebhookUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeWebhookUrlError("The webhook URL is not a valid URL.");
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new UnsafeWebhookUrlError("The webhook URL must use http:// or https://.");
  }
  if (url.username !== "" || url.password !== "") {
    throw new UnsafeWebhookUrlError("The webhook URL must not embed credentials.");
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (hostname === "" || hostname === "localhost") {
    throw new UnsafeWebhookUrlError("The webhook URL host is not allowed.");
  }
  if (BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    throw new UnsafeWebhookUrlError("The webhook URL host is not allowed.");
  }

  // A bracketed IPv6 literal arrives with brackets stripped by the URL parser.
  if (isIP(hostname) !== 0 && isPrivateOrReservedIp(hostname)) {
    throw new UnsafeWebhookUrlError("The webhook URL resolves to a non-public address.");
  }

  return url;
}

export type HostLookup = (hostname: string) => Promise<Array<{ address: string }>>;

const defaultLookup: HostLookup = (hostname) => lookup(hostname, { all: true });

/**
 * Structural checks plus DNS resolution. Rejects if any resolved address is non-public. Runs
 * immediately before an outbound request; failure is treated as fatal for that delivery.
 */
export async function assertResolvableToPublicAddress(
  rawUrl: string,
  hostLookup: HostLookup = defaultLookup,
): Promise<URL> {
  const url = assertSafeWebhookUrl(rawUrl);

  // A literal IP was already validated structurally; no DNS to resolve.
  if (isIP(url.hostname) !== 0) {
    return url;
  }

  let resolved: Array<{ address: string }>;
  try {
    resolved = await hostLookup(url.hostname);
  } catch {
    throw new UnsafeWebhookUrlError("The webhook URL host could not be resolved.");
  }
  if (resolved.length === 0) {
    throw new UnsafeWebhookUrlError("The webhook URL host could not be resolved.");
  }
  for (const { address } of resolved) {
    if (isPrivateOrReservedIp(address)) {
      throw new UnsafeWebhookUrlError("The webhook URL resolves to a non-public address.");
    }
  }
  return url;
}
