import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { isTrustedForwardedIp, parseTrustedClientIp } from "./client-ip.js";

const SECRET = "test-client-ip-signature-secret-at-least-32b";

function sign(ip: string, timestamp: number, secret: string = SECRET): string {
  const signature = createHmac("sha256", secret).update(`${ip}.${timestamp}`).digest("hex");
  return `${timestamp}.${signature}`;
}

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

describe("isTrustedForwardedIp", () => {
  const now = 1_800_000_000_000;

  it("accepts a fresh valid signature for IPv4 and IPv6", () => {
    expect(isTrustedForwardedIp("203.0.113.10", sign("203.0.113.10", now), SECRET, now)).toBe(true);
    expect(isTrustedForwardedIp("2001:db8::1", sign("2001:db8::1", now), SECRET, now)).toBe(true);
  });

  it("rejects a missing or malformed signature", () => {
    expect(isTrustedForwardedIp("203.0.113.10", undefined, SECRET, now)).toBe(false);
    expect(isTrustedForwardedIp("203.0.113.10", "", SECRET, now)).toBe(false);
    expect(isTrustedForwardedIp("203.0.113.10", "notasignature", SECRET, now)).toBe(false);
    expect(isTrustedForwardedIp("203.0.113.10", `${now}.short`, SECRET, now)).toBe(false);
  });

  it("rejects a signature computed with the wrong secret (forged)", () => {
    const forged = sign("203.0.113.10", now, "a-different-secret-that-is-at-least-32b");
    expect(isTrustedForwardedIp("203.0.113.10", forged, SECRET, now)).toBe(false);
  });

  it("rejects a signature for a different IP (header swapped)", () => {
    const other = sign("198.51.100.2", now);
    expect(isTrustedForwardedIp("203.0.113.10", other, SECRET, now)).toBe(false);
  });

  it("rejects an expired signature", () => {
    const stale = now - 61_000;
    expect(isTrustedForwardedIp("203.0.113.10", sign("203.0.113.10", stale), SECRET, now)).toBe(
      false,
    );
  });

  it("rejects a future-dated signature (clock skew / replay-ahead)", () => {
    const future = now + 5_000;
    expect(isTrustedForwardedIp("203.0.113.10", sign("203.0.113.10", future), SECRET, now)).toBe(
      false,
    );
  });

  it("accepts a just-replayed signature within the freshness window but binds it to the same ip+secret", () => {
    const signature = sign("203.0.113.10", now);
    expect(isTrustedForwardedIp("203.0.113.10", signature, SECRET, now)).toBe(true);
    // Replayed against a different IP or verified with a different secret fails.
    expect(isTrustedForwardedIp("198.51.100.2", signature, SECRET, now)).toBe(false);
  });
});
