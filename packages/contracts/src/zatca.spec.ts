import { describe, expect, it } from "vitest";

import {
  buildZatcaPhase1Tlv,
  encodeZatcaPhase1Qr,
  formatMinorForZatca,
  formatZatcaTimestamp,
  ZatcaEncodingError,
  type ZatcaPhase1Invoice,
} from "./zatca.js";

const invoice: ZatcaPhase1Invoice = {
  sellerName: "شركة حلول نجد التقنية",
  vatRegistrationNumber: "300123456700003",
  issuedAt: new Date("2026-08-06T11:02:52.482Z"),
  totalWithVatMinor: "575000",
  vatTotalMinor: "75000",
  currencyScale: 2,
};

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Independent base64 decoder, so the test does not reuse the implementation it is checking. */
function base64Decode(value: string): number[] {
  const clean = value.replace(/=+$/, "");
  let bits = 0;
  let acc = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    acc = (acc << 6) | BASE64_ALPHABET.indexOf(char);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((acc >> bits) & 0xff);
    }
  }
  return bytes;
}

function utf8Decode(bytes: readonly number[]): string {
  let out = "";
  for (let i = 0; i < bytes.length;) {
    const b0 = bytes[i]!;
    if (b0 < 0x80) {
      out += String.fromCodePoint(b0);
      i += 1;
    } else if (b0 < 0xe0) {
      out += String.fromCodePoint(((b0 & 0x1f) << 6) | (bytes[i + 1]! & 0x3f));
      i += 2;
    } else if (b0 < 0xf0) {
      out += String.fromCodePoint(
        ((b0 & 0x0f) << 12) | ((bytes[i + 1]! & 0x3f) << 6) | (bytes[i + 2]! & 0x3f),
      );
      i += 3;
    } else {
      out += String.fromCodePoint(
        ((b0 & 0x07) << 18) |
          ((bytes[i + 1]! & 0x3f) << 12) |
          ((bytes[i + 2]! & 0x3f) << 6) |
          (bytes[i + 3]! & 0x3f),
      );
      i += 4;
    }
  }
  return out;
}

/** Decode base64 TLV back into tag/value pairs so assertions read against the spec, not bytes. */
function decodeTlv(base64: string): Array<{ tag: number; value: string }> {
  const bytes = base64Decode(base64);
  const out: Array<{ tag: number; value: string }> = [];
  let i = 0;
  while (i < bytes.length) {
    const tag = bytes[i]!;
    const length = bytes[i + 1]!;
    out.push({ tag, value: utf8Decode(bytes.slice(i + 2, i + 2 + length)) });
    i += 2 + length;
  }
  return out;
}

describe("formatMinorForZatca", () => {
  it("formats minor units without going through a float", () => {
    expect(formatMinorForZatca("575000", 2)).toBe("5750.00");
    expect(formatMinorForZatca("75000", 2)).toBe("750.00");
    expect(formatMinorForZatca("1", 2)).toBe("0.01");
    expect(formatMinorForZatca("0", 2)).toBe("0.00");
    expect(formatMinorForZatca("100", 0)).toBe("100");
    expect(formatMinorForZatca("12345", 3)).toBe("12.345");
  });

  it("keeps precision on amounts beyond float-safe range", () => {
    expect(formatMinorForZatca("900719925474099100", 2)).toBe("9007199254740991.00");
  });

  it("handles credit-note style negatives", () => {
    expect(formatMinorForZatca("-575000", 2)).toBe("-5750.00");
  });

  it("rejects an unsupported scale", () => {
    expect(() => formatMinorForZatca("1", 9)).toThrow(ZatcaEncodingError);
  });
});

describe("formatZatcaTimestamp", () => {
  it("emits ISO 8601 UTC at second precision", () => {
    expect(formatZatcaTimestamp(new Date("2026-08-06T11:02:52.482Z"))).toBe("2026-08-06T11:02:52Z");
  });

  it("normalises a non-UTC instant to UTC", () => {
    expect(formatZatcaTimestamp(new Date("2026-08-06T14:02:52+03:00"))).toBe(
      "2026-08-06T11:02:52Z",
    );
  });

  it("rejects an invalid date", () => {
    expect(() => formatZatcaTimestamp(new Date("nonsense"))).toThrow(ZatcaEncodingError);
  });
});

describe("encodeZatcaPhase1Qr", () => {
  it("encodes the five Phase 1 tags in order", () => {
    expect(decodeTlv(encodeZatcaPhase1Qr(invoice))).toEqual([
      { tag: 1, value: "شركة حلول نجد التقنية" },
      { tag: 2, value: "300123456700003" },
      { tag: 3, value: "2026-08-06T11:02:52Z" },
      { tag: 4, value: "5750.00" },
      { tag: 5, value: "750.00" },
    ]);
  });

  it("uses the UTF-8 byte length for Arabic, not the character count", () => {
    const tlv = buildZatcaPhase1Tlv(invoice);
    expect(tlv[0]).toBe(1);
    // Arabic sits in the 2-byte UTF-8 range, so bytes must exceed characters.
    expect(tlv[1]).toBeGreaterThan(invoice.sellerName.length);
  });

  it("produces valid base64 that round-trips", () => {
    const encoded = encodeZatcaPhase1Qr(invoice);
    expect(encoded).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(base64Decode(encoded)).toEqual(buildZatcaPhase1Tlv(invoice));
  });

  it("requires seller name and VAT number", () => {
    expect(() => encodeZatcaPhase1Qr({ ...invoice, sellerName: "  " })).toThrow(ZatcaEncodingError);
    expect(() => encodeZatcaPhase1Qr({ ...invoice, vatRegistrationNumber: "" })).toThrow(
      ZatcaEncodingError,
    );
  });

  it("rejects a seller name longer than one TLV length byte can describe", () => {
    expect(() => encodeZatcaPhase1Qr({ ...invoice, sellerName: "ا".repeat(200) })).toThrow(
      ZatcaEncodingError,
    );
  });
});
