import { describe, expect, it } from "vitest";

import {
  assertResolvableToPublicAddress,
  assertSafeWebhookUrl,
  isPrivateOrReservedIp,
  UnsafeWebhookUrlError,
} from "./webhook-url.js";

describe("isPrivateOrReservedIp", () => {
  it("flags loopback, RFC1918, link-local, CGNAT, and reserved IPv4", () => {
    for (const ip of [
      "127.0.0.1",
      "10.0.0.5",
      "172.16.9.9",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "224.0.0.1",
      "255.255.255.255",
    ]) {
      expect(isPrivateOrReservedIp(ip), ip).toBe(true);
    }
  });

  it("flags loopback, ULA, link-local, and mapped-private IPv6", () => {
    for (const ip of ["::1", "::", "fc00::1", "fd12:3456::1", "fe80::1", "::ffff:10.0.0.1"]) {
      expect(isPrivateOrReservedIp(ip), ip).toBe(true);
    }
  });

  it("flags hexadecimal IPv4-mapped IPv6 (WHATWG-normalised form)", () => {
    // new URL("https://[::ffff:127.0.0.1]/").hostname === "[::ffff:7f00:1]"
    for (const ip of ["::ffff:7f00:1", "::ffff:0a00:1", "::ffff:c0a8:1"]) {
      expect(isPrivateOrReservedIp(ip), ip).toBe(true);
    }
  });

  it("accepts public IPv4/IPv6 addresses", () => {
    expect(isPrivateOrReservedIp("8.8.8.8")).toBe(false);
    expect(isPrivateOrReservedIp("1.1.1.1")).toBe(false);
    expect(isPrivateOrReservedIp("2606:4700:4700::1111")).toBe(false);
  });

  it("fails closed on non-IP input", () => {
    expect(isPrivateOrReservedIp("not-an-ip")).toBe(true);
  });
});

describe("assertSafeWebhookUrl", () => {
  it("accepts a normal public https URL", () => {
    expect(() => assertSafeWebhookUrl("https://hooks.example.com/ingest")).not.toThrow();
  });

  it("rejects non-https schemes (including plain http)", () => {
    for (const url of [
      "http://hooks.example.com/ingest",
      "ftp://example.com",
      "file:///etc/passwd",
      "gopher://example.com",
    ]) {
      expect(() => assertSafeWebhookUrl(url), url).toThrow(UnsafeWebhookUrlError);
    }
  });

  it("rejects localhost and internal-suffix hosts", () => {
    for (const url of [
      "https://localhost/hook",
      "https://localhost:8443/hook",
      "https://api.internal/hook",
      "https://db.local/hook",
      "https://svc.home.arpa/hook",
    ]) {
      expect(() => assertSafeWebhookUrl(url), url).toThrow(UnsafeWebhookUrlError);
    }
  });

  it("rejects literal private, loopback, and link-local IPs", () => {
    for (const url of [
      "https://127.0.0.1/hook",
      "https://10.1.2.3/hook",
      "https://192.168.0.5/hook",
      "https://169.254.169.254/latest/meta-data",
      "https://[::1]/hook",
      "https://[fd00::1]/hook",
      // Hexadecimal IPv4-mapped IPv6 → IPv4 loopback; must not slip past the guard.
      "https://[::ffff:127.0.0.1]/hook",
    ]) {
      expect(() => assertSafeWebhookUrl(url), url).toThrow(UnsafeWebhookUrlError);
    }
  });

  it("rejects URLs that embed credentials", () => {
    expect(() => assertSafeWebhookUrl("https://user:pass@example.com/hook")).toThrow(
      UnsafeWebhookUrlError,
    );
  });
});

describe("assertResolvableToPublicAddress", () => {
  it("accepts a hostname that resolves to a public address", async () => {
    const lookup = async () => [{ address: "93.184.216.34" }];
    await expect(
      assertResolvableToPublicAddress("https://hooks.example.com/x", lookup),
    ).resolves.toBeInstanceOf(URL);
  });

  it("rejects a public-looking hostname that resolves to a private address (DNS rebinding)", async () => {
    const lookup = async () => [{ address: "10.0.0.1" }];
    await expect(
      assertResolvableToPublicAddress("https://sneaky.example.com/x", lookup),
    ).rejects.toBeInstanceOf(UnsafeWebhookUrlError);
  });

  it("rejects when any resolved address is private", async () => {
    const lookup = async () => [{ address: "8.8.8.8" }, { address: "169.254.169.254" }];
    await expect(
      assertResolvableToPublicAddress("https://mixed.example.com/x", lookup),
    ).rejects.toBeInstanceOf(UnsafeWebhookUrlError);
  });

  it("fails closed when resolution fails", async () => {
    const lookup = async () => {
      throw new Error("ENOTFOUND");
    };
    await expect(
      assertResolvableToPublicAddress("https://nx.example.com/x", lookup),
    ).rejects.toBeInstanceOf(UnsafeWebhookUrlError);
  });

  it("still enforces structural checks before resolving", async () => {
    const lookup = async () => [{ address: "8.8.8.8" }];
    await expect(
      assertResolvableToPublicAddress("https://localhost/x", lookup),
    ).rejects.toBeInstanceOf(UnsafeWebhookUrlError);
  });
});
