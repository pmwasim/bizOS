import { describe, expect, it } from "vitest";

import { type LeadStatus } from "@bizo/contracts/crm";

import { computeLeadScore, type LeadScoringInput, toMinorBigInt } from "./lead-scoring.js";

function input(overrides: Partial<LeadScoringInput> = {}): LeadScoringInput {
  return {
    email: null,
    phone: null,
    company: null,
    source: null,
    estimatedValueMinor: null,
    status: "NEW",
    ...overrides,
  };
}

describe("computeLeadScore", () => {
  it("scores an empty NEW lead as 0", () => {
    expect(computeLeadScore(input())).toBe(0);
  });

  it("is deterministic for identical input", () => {
    const sample = input({ email: "a@b.example", source: "referral", status: "QUALIFIED" });
    expect(computeLeadScore(sample)).toBe(computeLeadScore(sample));
  });

  it("always scores a LOST lead as 0 regardless of other attributes", () => {
    const strong = input({
      email: "a@b.example",
      phone: "+1 555 000 1111",
      company: "Acme",
      source: "referral",
      estimatedValueMinor: 999_999_999n,
      status: "LOST",
    });
    expect(computeLeadScore(strong)).toBe(0);
  });

  it("caps at 100 for a maximally strong CONVERTED lead", () => {
    const best = input({
      email: "a@b.example",
      phone: "+1 555 000 1111",
      company: "Acme",
      source: "referral",
      estimatedValueMinor: 50_000_000n,
      status: "CONVERTED",
    });
    // 12 + 10 + 8 + 20 + 25 + 25 = 100
    expect(computeLeadScore(best)).toBe(100);
  });

  it("rewards email quality: valid > malformed > absent", () => {
    expect(computeLeadScore(input({ email: "valid@example.com" }))).toBe(12);
    expect(computeLeadScore(input({ email: "not-an-email" }))).toBe(6);
    expect(computeLeadScore(input({ email: null }))).toBe(0);
    expect(computeLeadScore(input({ email: "   " }))).toBe(0);
  });

  it("rewards phone quality: >= 7 digits > short > absent", () => {
    expect(computeLeadScore(input({ phone: "555-123-4567" }))).toBe(10);
    expect(computeLeadScore(input({ phone: "12345" }))).toBe(5);
    expect(computeLeadScore(input({ phone: null }))).toBe(0);
  });

  it("scores company presence", () => {
    expect(computeLeadScore(input({ company: "Acme" }))).toBe(8);
    expect(computeLeadScore(input({ company: "" }))).toBe(0);
  });

  it("ranks source referral > web > cold > none", () => {
    const referral = computeLeadScore(input({ source: "referral" }));
    const web = computeLeadScore(input({ source: "web" }));
    const cold = computeLeadScore(input({ source: "cold" }));
    const none = computeLeadScore(input({ source: null }));
    expect(referral).toBe(20);
    expect(web).toBe(12);
    expect(cold).toBe(4);
    expect(none).toBe(0);
    expect(referral).toBeGreaterThan(web);
    expect(web).toBeGreaterThan(cold);
    expect(cold).toBeGreaterThan(none);
    // An unknown, non-empty source gets the neutral middle weight.
    expect(computeLeadScore(input({ source: "linkedin" }))).toBe(8);
    // Case-insensitive.
    expect(computeLeadScore(input({ source: "ReFeRRaL" }))).toBe(20);
  });

  it("bands estimated value on its boundaries", () => {
    expect(computeLeadScore(input({ estimatedValueMinor: 0n }))).toBe(0);
    expect(computeLeadScore(input({ estimatedValueMinor: -5n }))).toBe(0);
    expect(computeLeadScore(input({ estimatedValueMinor: 1n }))).toBe(5);
    expect(computeLeadScore(input({ estimatedValueMinor: 99_999n }))).toBe(5);
    expect(computeLeadScore(input({ estimatedValueMinor: 100_000n }))).toBe(12);
    expect(computeLeadScore(input({ estimatedValueMinor: 999_999n }))).toBe(12);
    expect(computeLeadScore(input({ estimatedValueMinor: 1_000_000n }))).toBe(20);
    expect(computeLeadScore(input({ estimatedValueMinor: 9_999_999n }))).toBe(20);
    expect(computeLeadScore(input({ estimatedValueMinor: 10_000_000n }))).toBe(25);
  });

  it("increases monotonically with status progression (excluding LOST)", () => {
    const base = { email: "a@b.example", company: "Acme", source: "web" } as const;
    const order: LeadStatus[] = ["NEW", "CONTACTED", "QUALIFIED", "CONVERTED"];
    const scores = order.map((status) => computeLeadScore(input({ ...base, status })));
    for (let i = 1; i < scores.length; i += 1) {
      expect(scores[i]).toBeGreaterThan(scores[i - 1] as number);
    }
  });
});

describe("toMinorBigInt", () => {
  it("returns null for null/undefined/empty", () => {
    expect(toMinorBigInt(null)).toBeNull();
    expect(toMinorBigInt(undefined)).toBeNull();
    expect(toMinorBigInt("")).toBeNull();
  });

  it("parses integer-minor-unit strings", () => {
    expect(toMinorBigInt("250000")).toBe(250_000n);
  });

  it("truncates a fractional string to its integer-minor part", () => {
    expect(toMinorBigInt("1234.56")).toBe(1_234n);
  });

  it("reads a Decimal-like object via toFixed", () => {
    expect(toMinorBigInt({ toFixed: () => "7500" })).toBe(7_500n);
  });

  it("returns null for unparseable input", () => {
    expect(toMinorBigInt("abc")).toBeNull();
  });
});
