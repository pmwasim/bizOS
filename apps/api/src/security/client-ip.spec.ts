import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { parseTrustedClientIp } from "./client-ip.js";

const SECRET = "internal-secret-for-tests-at-least-32-bytes";

function sign(ip: string, secret = SECRET): string {
  return createHmac("sha256", secret).update(ip).digest("hex");
}

describe("parseTrustedClientIp", () => {
  it("accepts single IPv4 and IPv6 addresses carrying a valid signature", () => {
    expect(parseTrustedClientIp("203.0.113.10", sign("203.0.113.10"), SECRET)).toBe("203.0.113.10");
    expect(parseTrustedClientIp("2001:db8::1", sign("2001:db8::1"), SECRET)).toBe("2001:db8::1");
  });

  it("rejects lists, blanks, and non-IP values", () => {
    const list = "203.0.113.10, 198.51.100.2";
    expect(parseTrustedClientIp(list, sign(list), SECRET)).toBeUndefined();
    expect(parseTrustedClientIp("", sign(""), SECRET)).toBeUndefined();
    expect(parseTrustedClientIp("not-an-ip", sign("not-an-ip"), SECRET)).toBeUndefined();
    expect(parseTrustedClientIp(["203.0.113.10"], sign("203.0.113.10"), SECRET)).toBeUndefined();
  });

  it("rejects a well-formed IP with no signature", () => {
    expect(parseTrustedClientIp("203.0.113.10", undefined, SECRET)).toBeUndefined();
    expect(parseTrustedClientIp("203.0.113.10", "", SECRET)).toBeUndefined();
  });

  it("rejects a signature produced with a different secret", () => {
    expect(
      parseTrustedClientIp("203.0.113.10", sign("203.0.113.10", "attacker-secret"), SECRET),
    ).toBeUndefined();
  });

  it("rejects a signature bound to a different IP, so buckets cannot be rotated", () => {
    expect(parseTrustedClientIp("198.51.100.7", sign("203.0.113.10"), SECRET)).toBeUndefined();
  });

  it("rejects malformed and wrong-length signatures without throwing", () => {
    expect(parseTrustedClientIp("203.0.113.10", "zzzz", SECRET)).toBeUndefined();
    expect(parseTrustedClientIp("203.0.113.10", "abcd", SECRET)).toBeUndefined();
    expect(
      parseTrustedClientIp("203.0.113.10", sign("203.0.113.10") + "ab", SECRET),
    ).toBeUndefined();
  });
});
