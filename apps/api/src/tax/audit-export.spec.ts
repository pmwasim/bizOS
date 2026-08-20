import { describe, expect, it } from "vitest";

import {
  buildReturnBoxes,
  TAX_COUNTRY_PACKS,
  type TaxCountryCode,
  type TaxCurrencySummary,
  type TaxReturnAudit,
  type TaxReturnDocument,
  type TaxReturnSummary,
} from "@bizo/contracts/tax";

import {
  auditExportFilename,
  returnSummaryFilename,
  toAuditCsv,
  toReturnSummaryCsv,
} from "./audit-export.js";

function document(overrides: Partial<TaxReturnDocument> = {}): TaxReturnDocument {
  return {
    id: "d1",
    direction: "OUTPUT",
    documentType: "INVOICE",
    number: "INV-1",
    issueDate: "2026-02-10",
    partyName: "Acme",
    currency: "SAR",
    currencyScale: 2,
    subtotalMinor: "100000",
    taxMinor: "15000",
    totalMinor: "115000",
    ...overrides,
  };
}

describe("toAuditCsv", () => {
  it("writes a header and one row per document with money left as minor units", () => {
    const csv = toAuditCsv([document()]);
    const lines = csv.trimEnd().split("\r\n");
    expect(lines[0]).toBe(
      "direction,documentType,number,issueDate,partyName,currency,currencyScale,subtotalMinor,taxMinor,totalMinor",
    );
    expect(lines[1]).toBe("OUTPUT,INVOICE,INV-1,2026-02-10,Acme,SAR,2,100000,15000,115000");
  });

  it("quotes and escapes a party name containing a comma or quote so columns cannot shift", () => {
    const csv = toAuditCsv([document({ partyName: 'Smith, Jones & "Co"' })]);
    expect(csv).toContain('"Smith, Jones & ""Co"""');
  });
});

describe("auditExportFilename", () => {
  it("names the file by country and period", () => {
    const audit = {
      summary: { countryCode: "SA", periodStart: "2026-01-01", periodEnd: "2026-03-31" },
    } as TaxReturnAudit;
    expect(auditExportFilename(audit, "csv")).toBe("tax-return-SA-2026-01-01_2026-03-31.csv");
  });

  it("omits the period when the return covers all documents", () => {
    const audit = {
      summary: { countryCode: "AE", periodStart: null, periodEnd: null },
    } as TaxReturnAudit;
    expect(auditExportFilename(audit, "json")).toBe("tax-return-AE.json");
  });
});

/**
 * A per-currency summary block whose boxes are built from the real country pack, so the CSV rows are
 * exactly the labels and figures the aggregation would produce for that regime.
 */
function currencySummary(
  countryCode: TaxCountryCode,
  overrides: {
    currency: string;
    currencyScale?: number;
    isBaseCurrency?: boolean;
    outputTaxableBaseMinor?: bigint;
    outputTaxMinor?: bigint;
    inputTaxableBaseMinor?: bigint;
    inputTaxMinor?: bigint;
  },
): TaxCurrencySummary {
  const outputTaxableBaseMinor = overrides.outputTaxableBaseMinor ?? 0n;
  const outputTaxMinor = overrides.outputTaxMinor ?? 0n;
  const inputTaxableBaseMinor = overrides.inputTaxableBaseMinor ?? 0n;
  const inputTaxMinor = overrides.inputTaxMinor ?? 0n;
  const netTaxMinor = outputTaxMinor - inputTaxMinor;
  return {
    currency: overrides.currency,
    currencyScale: overrides.currencyScale ?? 2,
    isBaseCurrency: overrides.isBaseCurrency ?? true,
    outputTaxableBaseMinor: outputTaxableBaseMinor.toString(),
    outputTaxMinor: outputTaxMinor.toString(),
    inputTaxableBaseMinor: inputTaxableBaseMinor.toString(),
    inputTaxMinor: inputTaxMinor.toString(),
    netTaxMinor: netTaxMinor.toString(),
    netPosition: netTaxMinor > 0n ? "PAYABLE" : netTaxMinor < 0n ? "REFUNDABLE" : "NIL",
    salesCount: 0,
    purchaseCount: 0,
    boxes: buildReturnBoxes(TAX_COUNTRY_PACKS[countryCode].boxes, {
      outputTaxableBaseMinor,
      outputTaxMinor,
      inputTaxableBaseMinor,
      inputTaxMinor,
      netTaxMinor,
    }),
  };
}

function summary(countryCode: TaxCountryCode, currencies: TaxCurrencySummary[]): TaxReturnSummary {
  const pack = TAX_COUNTRY_PACKS[countryCode];
  return {
    countryCode: pack.countryCode,
    countryName: pack.countryName,
    taxSystem: pack.taxSystem,
    taxAuthority: pack.taxAuthority,
    returnName: pack.returnName,
    standardRatePpm: pack.standardRatePpm,
    baseCurrency: currencies[0]?.currency ?? "SAR",
    currencyScale: 2,
    periodStart: null,
    periodEnd: null,
    currencies,
  };
}

describe("toReturnSummaryCsv", () => {
  it("writes the return-box header and one row per currency per box", () => {
    const csv = toReturnSummaryCsv(
      summary("SA", [
        currencySummary("SA", {
          currency: "SAR",
          outputTaxableBaseMinor: 100000n,
          outputTaxMinor: 15000n,
          inputTaxableBaseMinor: 40000n,
          inputTaxMinor: 6000n,
        }),
      ]),
    );
    const lines = csv.trimEnd().split("\r\n");
    expect(lines[0]).toBe(
      "countryCode,returnName,currency,currencyScale,isBaseCurrency,boxCode,boxLabel,boxSource,amountMinor,netPosition",
    );
    // Five ZATCA boxes, one row each, in pack order.
    expect(lines).toHaveLength(1 + 5);
    expect(lines[1]).toBe(
      "SA,VAT Return,SAR,2,true,1,Standard-rated sales,OUTPUT_BASE,100000,PAYABLE",
    );
    // The net box carries output − input = 15000 − 6000 = 9000, reconciling to the summary.
    expect(lines[5]).toBe("SA,VAT Return,SAR,2,true,14,Net VAT due,NET_TAX,9000,PAYABLE");
  });

  it("carries each country's own return name and box labels (SA vs AE vs IN)", () => {
    const saCsv = toReturnSummaryCsv(summary("SA", [currencySummary("SA", { currency: "SAR" })]));
    const aeCsv = toReturnSummaryCsv(summary("AE", [currencySummary("AE", { currency: "AED" })]));
    const inCsv = toReturnSummaryCsv(summary("IN", [currencySummary("IN", { currency: "INR" })]));

    expect(saCsv).toContain("SA,VAT Return,");
    expect(saCsv).toContain("Net VAT due,NET_TAX");
    expect(aeCsv).toContain("AE,VAT 201 Return,");
    expect(aeCsv).toContain("Recoverable input VAT,INPUT_TAX");
    expect(inCsv).toContain("IN,GSTR-3B Summary,");
    expect(inCsv).toContain("Eligible input tax credit,INPUT_TAX");
  });

  it("emits every currency block, base currency first, and never sums across them", () => {
    const csv = toReturnSummaryCsv(
      summary("SA", [
        currencySummary("SA", { currency: "SAR", isBaseCurrency: true, outputTaxMinor: 15000n }),
        currencySummary("SA", { currency: "USD", isBaseCurrency: false, inputTaxMinor: 3000n }),
      ]),
    );
    // Both currencies appear, each with its own five boxes; nothing is blended into one total.
    expect(csv).toContain(",SAR,2,true,");
    expect(csv).toContain(",USD,2,false,");
    const rows = csv.trimEnd().split("\r\n").slice(1);
    expect(rows).toHaveLength(10);
    expect(rows.find((row) => row.includes(",USD,") && row.includes("NET_TAX"))).toContain(
      "-3000,REFUNDABLE",
    );
  });

  it("quotes and escapes a box label containing a comma or quote so columns cannot shift", () => {
    const base = summary("SA", [currencySummary("SA", { currency: "SAR" })]);
    // A hypothetical pack whose label needs escaping — the serialiser must not let it shift columns.
    const withTrickyLabel: TaxReturnSummary = {
      ...base,
      currencies: [
        {
          ...base.currencies[0]!,
          boxes: [
            {
              code: "X",
              label: 'Sales, incl. "reverse charge"',
              source: "OUTPUT_BASE",
              amountMinor: "100",
            },
          ],
        },
      ],
    };
    const csv = toReturnSummaryCsv(withTrickyLabel);
    expect(csv).toContain('"Sales, incl. ""reverse charge"""');
  });
});

describe("returnSummaryFilename", () => {
  it("names the summary file distinctly from the detail file, by country and period", () => {
    const audit = {
      summary: { countryCode: "SA", periodStart: "2026-01-01", periodEnd: "2026-03-31" },
    } as TaxReturnAudit;
    expect(returnSummaryFilename(audit, "csv")).toBe(
      "tax-return-summary-SA-2026-01-01_2026-03-31.csv",
    );
    // Distinct from the line-level detail export for the same return.
    expect(returnSummaryFilename(audit, "csv")).not.toBe(auditExportFilename(audit, "csv"));
  });

  it("omits the period when the return covers all documents", () => {
    const audit = {
      summary: { countryCode: "IN", periodStart: null, periodEnd: null },
    } as TaxReturnAudit;
    expect(returnSummaryFilename(audit, "json")).toBe("tax-return-summary-IN.json");
  });
});
