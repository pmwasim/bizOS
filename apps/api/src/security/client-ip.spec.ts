import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { isTrustedForwardedIp, parseTrustedClientIp } from "./client-ip.js";

const SECRET = "test-client-ip-signature-secret-at-least-32b";

function sign(ip: string, timestamp: number, secret: string = SECRET): string {
  const signature = createHmac("sha256", secret).update(`${ip}.${timestamp}`).digest("hex");
  return `${timestamp}.${signature}`;
}

describe("parseTrustedClientIp", () => {
  it("accepts single IPv4 and IPv6 addresses", () => {
    expect(parseTrustedClientIp("203.0.113.10")).toBe("203.0.113.10");
    expect(parseTrustedClientIp("2001:db8::1")).toBe("2001:db8::1");
  });

  it("rejects lists, blanks, and non-IP values", () => {
    expect(parseTrustedClientIp("203.0.113.10, 198.51.100.2")).toBeUndefined();
    expect(parseTrustedClientIp("")).toBeUndefined();
    expect(parseTrustedClientIp("not-an-ip")).toBeUndefined();
    expect(parseTrustedClientIp(["203.0.113.10"])).toBeUndefined();
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
