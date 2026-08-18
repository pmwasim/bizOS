import { describe, expect, it } from "vitest";

import {
  addBuckets,
  ageInvoices,
  bucketFor,
  compareMinorDesc,
  daysPastDue,
  overdueTotal,
  sumMinor,
} from "./ageing.js";

describe("daysPastDue", () => {
  it("counts whole days and treats the due date itself as not late", () => {
    expect(daysPastDue("2026-06-30", "2026-06-30")).toBe(0);
    expect(daysPastDue("2026-06-30", "2026-07-01")).toBe(1);
    expect(daysPastDue("2026-06-30", "2026-06-29")).toBe(-1);
  });

  it("counts across a month and a leap-year February", () => {
    expect(daysPastDue("2026-01-31", "2026-03-01")).toBe(29);
    expect(daysPastDue("2028-02-01", "2028-03-01")).toBe(29);
  });
});

describe("bucketFor", () => {
  it("places each day count in exactly one bucket at the boundaries", () => {
    expect(bucketFor(0)).toBe("notDueMinor");
    expect(bucketFor(-5)).toBe("notDueMinor");
    expect(bucketFor(1)).toBe("days1To30Minor");
    expect(bucketFor(30)).toBe("days1To30Minor");
    expect(bucketFor(31)).toBe("days31To60Minor");
    expect(bucketFor(60)).toBe("days31To60Minor");
    expect(bucketFor(61)).toBe("days61To90Minor");
    expect(bucketFor(90)).toBe("days61To90Minor");
    expect(bucketFor(91)).toBe("daysOver90Minor");
  });
});

describe("ageInvoices", () => {
  it("sums whole invoice amounts so buckets reconcile to the total exactly", () => {
    const buckets = ageInvoices(
      [
        { dueDate: "2026-07-15", outstandingMinor: 333n },
        { dueDate: "2026-06-01", outstandingMinor: 3334n },
        { dueDate: "2026-01-01", outstandingMinor: 3333n },
      ],
      "2026-06-30",
    );

    // Apportioning by percentage would not land on 7000 for amounts that do not divide evenly.
    expect(sumMinor(Object.values(buckets))).toBe("7000");
    expect(buckets.notDueMinor).toBe("333");
    expect(buckets.days1To30Minor).toBe("3334");
    expect(buckets.daysOver90Minor).toBe("3333");
  });

  it("ignores settled and negative invoices", () => {
    const buckets = ageInvoices(
      [
        { dueDate: "2026-01-01", outstandingMinor: 0n },
        { dueDate: "2026-01-01", outstandingMinor: -500n },
      ],
      "2026-06-30",
    );

    expect(overdueTotal(buckets)).toBe("0");
  });

  it("keeps minor units exact above Number.MAX_SAFE_INTEGER (ADR-0008)", () => {
    // 2^53 + 1 in minor units cannot be held exactly by a JS number; the buckets carry it as a
    // string so the value never rounds.
    const huge = 9_007_199_254_740_993n;
    const buckets = ageInvoices([{ dueDate: "2026-01-01", outstandingMinor: huge }], "2026-06-30");

    expect(buckets.daysOver90Minor).toBe("9007199254740993");
    expect(overdueTotal(buckets)).toBe("9007199254740993");
  });
});

describe("addBuckets", () => {
  it("rolls customer ageing up into a business total", () => {
    const left = ageInvoices([{ dueDate: "2026-05-01", outstandingMinor: 100n }], "2026-06-30");
    const right = ageInvoices([{ dueDate: "2026-01-01", outstandingMinor: 200n }], "2026-06-30");

    expect(addBuckets(left, right)).toEqual({
      notDueMinor: "0",
      days1To30Minor: "0",
      days31To60Minor: "100",
      days61To90Minor: "0",
      daysOver90Minor: "200",
    });
  });
});

describe("sumMinor and compareMinorDesc", () => {
  it("sums exact minor-units strings and orders them largest-first", () => {
    expect(sumMinor(["100", "250", "0"])).toBe("350");
    expect(sumMinor([])).toBe("0");
    expect(compareMinorDesc("100", "250")).toBeGreaterThan(0);
    expect(compareMinorDesc("250", "100")).toBeLessThan(0);
    expect(compareMinorDesc("100", "100")).toBe(0);
  });
});
