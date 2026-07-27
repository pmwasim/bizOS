import { describe, expect, it } from "vitest";

import { parseTrustedClientIp } from "./client-ip.js";

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
