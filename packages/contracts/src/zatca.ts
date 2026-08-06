/**
 * ZATCA (Saudi Arabia) Phase 1 e-invoicing QR payload.
 *
 * Phase 1 ("generation") requires a base64 TLV string carried in a QR code on tax invoices. Each
 * field is `[tag byte][length byte][UTF-8 value bytes]`, concatenated in tag order, then base64
 * encoded.
 *
 * Scope boundary — this is Phase 1 only. It does NOT implement Phase 2 ("integration"): no
 * cryptographic stamp, no UUID/hash chaining, no signed XML, and no Fatoora clearance or reporting.
 * A Phase 1 QR is not a substitute for Phase 2 compliance where Phase 2 applies.
 *
 * Reference: ZATCA E-Invoicing Detailed Technical Guideline, Phase 1 QR specification.
 */

export const ZATCA_TAGS = {
  SELLER_NAME: 1,
  VAT_REGISTRATION_NUMBER: 2,
  TIMESTAMP: 3,
  INVOICE_TOTAL_WITH_VAT: 4,
  VAT_TOTAL: 5,
} as const;

/** A single TLV field value may not exceed 255 bytes, because length is encoded in one byte. */
const MAX_FIELD_BYTES = 255;

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * UTF-8 and base64 are implemented here rather than taken from `TextEncoder`/`Buffer` because this
 * package is transport-neutral and must not depend on Node or DOM globals.
 */
function utf8Encode(value: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < value.length; i += 1) {
    const point = value.codePointAt(i)!;
    if (point > 0xff_ff) {
      i += 1; // Surrogate pair consumed as a single code point.
    }
    if (point < 0x80) {
      bytes.push(point);
    } else if (point < 0x800) {
      bytes.push(0xc0 | (point >> 6), 0x80 | (point & 0x3f));
    } else if (point < 0x1_00_00) {
      bytes.push(0xe0 | (point >> 12), 0x80 | ((point >> 6) & 0x3f), 0x80 | (point & 0x3f));
    } else {
      bytes.push(
        0xf0 | (point >> 18),
        0x80 | ((point >> 12) & 0x3f),
        0x80 | ((point >> 6) & 0x3f),
        0x80 | (point & 0x3f),
      );
    }
  }
  return bytes;
}

function base64Encode(bytes: readonly number[]): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += BASE64_ALPHABET[b0 >> 2];
    out += BASE64_ALPHABET[((b0 & 0x03) << 4) | ((b1 ?? 0) >> 4)];
    out += b1 === undefined ? "=" : BASE64_ALPHABET[((b1 & 0x0f) << 2) | ((b2 ?? 0) >> 6)];
    out += b2 === undefined ? "=" : BASE64_ALPHABET[b2 & 0x3f];
  }
  return out;
}

export interface ZatcaPhase1Invoice {
  /**
   * Seller legal name. ZATCA expects the Arabic name where the seller has one, so callers should
   * pass the Arabic legal name in preference to a transliteration.
   */
  sellerName: string;
  /** Seller 15-digit VAT registration number. */
  vatRegistrationNumber: string;
  /** Invoice issue instant. Encoded as ISO 8601 in UTC (`Z`), per the Phase 1 guideline. */
  issuedAt: Date;
  /** Invoice total including VAT, in minor units (for example halalas). */
  totalWithVatMinor: bigint | string;
  /** VAT total, in minor units. */
  vatTotalMinor: bigint | string;
  /** Minor units per major unit exponent. SAR uses 2. */
  currencyScale: number;
}

export class ZatcaEncodingError extends Error {}

function encodeField(tag: number, value: string): number[] {
  const bytes = utf8Encode(value);
  if (bytes.length > MAX_FIELD_BYTES) {
    throw new ZatcaEncodingError(
      `ZATCA TLV tag ${tag} is ${bytes.length} bytes; the maximum is ${MAX_FIELD_BYTES}.`,
    );
  }
  return [tag, bytes.length, ...bytes];
}

/**
 * Format a minor-unit amount as a plain decimal string.
 *
 * Money stays in minor units end to end so this never goes through a float, which would be capable
 * of turning a halala into a rounding difference on a tax document.
 */
export function formatMinorForZatca(minor: bigint | string, scale: number): string {
  if (!Number.isInteger(scale) || scale < 0 || scale > 4) {
    throw new ZatcaEncodingError(`Unsupported currency scale ${scale}.`);
  }
  const value = typeof minor === "bigint" ? minor : BigInt(minor);
  const negative = value < 0n;
  const digits = (negative ? -value : value).toString().padStart(scale + 1, "0");
  const whole = digits.slice(0, digits.length - scale);
  const fraction = scale === 0 ? "" : `.${digits.slice(digits.length - scale)}`;
  return `${negative ? "-" : ""}${whole}${fraction}`;
}

/** ISO 8601 in UTC with second precision, for example `2026-08-06T11:02:52Z`. */
export function formatZatcaTimestamp(issuedAt: Date): string {
  if (Number.isNaN(issuedAt.getTime())) {
    throw new ZatcaEncodingError("Invoice timestamp is not a valid date.");
  }
  return `${issuedAt.toISOString().slice(0, 19)}Z`;
}

/** Build the raw TLV byte sequence, before base64. Exposed for testing and inspection. */
export function buildZatcaPhase1Tlv(invoice: ZatcaPhase1Invoice): number[] {
  const sellerName = invoice.sellerName.trim();
  const vatNumber = invoice.vatRegistrationNumber.trim();
  if (!sellerName) {
    throw new ZatcaEncodingError("Seller name is required for the ZATCA QR payload.");
  }
  if (!vatNumber) {
    throw new ZatcaEncodingError("VAT registration number is required for the ZATCA QR payload.");
  }

  const fields = [
    encodeField(ZATCA_TAGS.SELLER_NAME, sellerName),
    encodeField(ZATCA_TAGS.VAT_REGISTRATION_NUMBER, vatNumber),
    encodeField(ZATCA_TAGS.TIMESTAMP, formatZatcaTimestamp(invoice.issuedAt)),
    encodeField(
      ZATCA_TAGS.INVOICE_TOTAL_WITH_VAT,
      formatMinorForZatca(invoice.totalWithVatMinor, invoice.currencyScale),
    ),
    encodeField(
      ZATCA_TAGS.VAT_TOTAL,
      formatMinorForZatca(invoice.vatTotalMinor, invoice.currencyScale),
    ),
  ];

  return fields.flat();
}

/** The base64 TLV string that goes inside the Phase 1 QR code. */
export function encodeZatcaPhase1Qr(invoice: ZatcaPhase1Invoice): string {
  return base64Encode(buildZatcaPhase1Tlv(invoice));
}
