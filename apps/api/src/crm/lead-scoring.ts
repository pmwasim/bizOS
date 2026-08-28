import { type LeadStatus } from "@bizo/contracts/crm";

/**
 * Deterministic lead scoring.
 *
 * The score is an integer in the range [0, 100] computed purely from a lead's
 * attributes. It is intentionally rule-based (no randomness, no I/O) so the same
 * input always yields the same output and the weighting is auditable.
 *
 * The four weighted components sum to a natural maximum of 100:
 *
 *   1. Contactability (max 30) — how reachable the lead is.
 *        email:   valid-looking +12, present-but-malformed +6, absent 0
 *        phone:   >= 7 digits   +10, present-but-short      +5, absent 0
 *        company: present        +8,                             absent 0
 *   2. Source quality (max 20) — where the lead came from.
 *        referral/partner 20 > event/tradeshow 16 > web/inbound 12 >
 *        outbound 8 > cold/purchased 4 > unknown source 8 > no source 0
 *   3. Estimated value band (max 25) — deal size, in integer minor units.
 *        0 / null 0 | < 1,000.00 → 5 | < 10,000.00 → 12 |
 *        < 100,000.00 → 20 | >= 100,000.00 → 25
 *   4. Status progression (max 25) — how far down the funnel the lead is.
 *        NEW 0 < CONTACTED 8 < QUALIFIED 18 < CONVERTED 25
 *
 * Special case: a LOST lead always scores 0, regardless of its other
 * attributes — a lost lead carries no pipeline value.
 */

export interface LeadScoringInput {
  email: string | null;
  phone: string | null;
  company: string | null;
  source: string | null;
  /** Estimated deal value in integer minor units, or null when unknown. */
  estimatedValueMinor: bigint | null;
  status: LeadStatus;
}

export const LEAD_SCORE_MIN = 0;
export const LEAD_SCORE_MAX = 100;

// Value bands are expressed in minor units (e.g. cents). 100_000 minor = 1,000.00.
const VALUE_BAND_SMALL = 100_000n; // 1,000.00
const VALUE_BAND_MEDIUM = 1_000_000n; // 10,000.00
const VALUE_BAND_LARGE = 10_000_000n; // 100,000.00

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function scoreEmail(email: string | null): number {
  const value = email?.trim() ?? "";
  if (value.length === 0) return 0;
  return EMAIL_PATTERN.test(value) ? 12 : 6;
}

function scorePhone(phone: string | null): number {
  const value = phone?.trim() ?? "";
  if (value.length === 0) return 0;
  const digitCount = (value.match(/\d/g) ?? []).length;
  return digitCount >= 7 ? 10 : 5;
}

function scoreCompany(company: string | null): number {
  return (company?.trim().length ?? 0) > 0 ? 8 : 0;
}

function scoreSource(source: string | null): number {
  const value = source?.trim().toLowerCase() ?? "";
  if (value.length === 0) return 0;
  switch (value) {
    case "referral":
    case "partner":
      return 20;
    case "event":
    case "tradeshow":
      return 16;
    case "web":
    case "inbound":
    case "website":
      return 12;
    case "outbound":
      return 8;
    case "cold":
    case "purchased":
      return 4;
    default:
      return 8;
  }
}

function scoreValue(estimatedValueMinor: bigint | null): number {
  if (estimatedValueMinor === null || estimatedValueMinor <= 0n) return 0;
  if (estimatedValueMinor < VALUE_BAND_SMALL) return 5;
  if (estimatedValueMinor < VALUE_BAND_MEDIUM) return 12;
  if (estimatedValueMinor < VALUE_BAND_LARGE) return 20;
  return 25;
}

function scoreStatus(status: LeadStatus): number {
  switch (status) {
    case "NEW":
      return 0;
    case "CONTACTED":
      return 8;
    case "QUALIFIED":
      return 18;
    case "CONVERTED":
      return 25;
    case "LOST":
      return 0;
  }
}

/**
 * Compute the deterministic 0–100 lead score. Pure: no side effects, no I/O.
 */
export function computeLeadScore(input: LeadScoringInput): number {
  // A lost lead has no pipeline value, so it always scores the floor.
  if (input.status === "LOST") return LEAD_SCORE_MIN;

  const total =
    scoreEmail(input.email) +
    scorePhone(input.phone) +
    scoreCompany(input.company) +
    scoreSource(input.source) +
    scoreValue(input.estimatedValueMinor) +
    scoreStatus(input.status);

  // Clamp defensively; the weights already sum to at most 100.
  return Math.max(LEAD_SCORE_MIN, Math.min(LEAD_SCORE_MAX, total));
}

/**
 * Coerce an estimated value from the various shapes the persistence layer and
 * request contracts use (integer-minor-unit string, Prisma Decimal, or null)
 * into a bigint of minor units for scoring. Fractional input is truncated to
 * its integer-minor part; unparseable input becomes null.
 */
export function toMinorBigInt(
  value: string | { toFixed(digits: number): string } | null | undefined,
): bigint | null {
  if (value === null || value === undefined) return null;
  const asString = typeof value === "string" ? value : value.toFixed(0);
  const integerPart = asString.trim().split(".")[0];
  if (integerPart === undefined || integerPart.length === 0) return null;
  try {
    return BigInt(integerPart);
  } catch {
    return null;
  }
}
