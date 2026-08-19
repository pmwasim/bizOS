import { describe, expect, it } from "vitest";

import {
  buildReturnBoxes,
  netPositionForMinor,
  resolveTaxCountryPack,
  TAX_COUNTRY_PACKS,
  taxReturnAuditSchema,
} from "./tax.js";

describe("resolveTaxCountryPack", () => {
  it("resolves the three shipped packs and fails closed on anything else", () => {
    expect(resolveTaxCountryPack("SA")?.taxAuthority).toBe("ZATCA");
    expect(resolveTaxCountryPack("AE")?.taxSystem).toBe("VAT");
    expect(resolveTaxCountryPack("IN")?.taxSystem).toBe("GST");
    // A country with no pack returns null rather than a guessed regime.
    expect(resolveTaxCountryPack("US")).toBeNull();
    expect(resolveTaxCountryPack("")).toBeNull();
  });

  it("keeps each pack's headline standard rate", () => {
    expect(TAX_COUNTRY_PACKS.SA.standardRatePpm).toBe(150_000);
    expect(TAX_COUNTRY_PACKS.AE.standardRatePpm).toBe(50_000);
    expect(TAX_COUNTRY_PACKS.IN.standardRatePpm).toBe(180_000);
  });
});

describe("netPositionForMinor", () => {
  it("reads the sign of the net figure", () => {
    expect(netPositionForMinor(500n)).toBe("PAYABLE");
    expect(netPositionForMinor(-500n)).toBe("REFUNDABLE");
    expect(netPositionForMinor(0n)).toBe("NIL");
  });
});

describe("buildReturnBoxes", () => {
  const figures = {
    outputTaxableBaseMinor: 100_000n,
    outputTaxMinor: 15_000n,
    inputTaxableBaseMinor: 40_000n,
    inputTaxMinor: 6_000n,
    netTaxMinor: 9_000n,
  };

  it("binds every box to its source figure and reconciles to the aggregation", () => {
    const boxes = buildReturnBoxes(TAX_COUNTRY_PACKS.SA.boxes, figures);
    const bySource = Object.fromEntries(boxes.map((box) => [box.source, box.amountMinor]));
    expect(bySource.OUTPUT_BASE).toBe("100000");
    expect(bySource.OUTPUT_TAX).toBe("15000");
    expect(bySource.INPUT_BASE).toBe("40000");
    expect(bySource.INPUT_TAX).toBe("6000");
    // The net box is exactly output − input, so the boxes reconcile.
    expect(bySource.NET_TAX).toBe("9000");
  });

  it("labels the same figures differently per country pack", () => {
    const sa = buildReturnBoxes(TAX_COUNTRY_PACKS.SA.boxes, figures);
    const ind = buildReturnBoxes(TAX_COUNTRY_PACKS.IN.boxes, figures);
    // The input-tax box is "deductible input VAT" for SA but "input tax credit" for India, while the
    // underlying amount is identical — the pack changes the label, never the number.
    const saInput = sa.find((box) => box.source === "INPUT_TAX")!;
    const inInput = ind.find((box) => box.source === "INPUT_TAX")!;
    expect(saInput.label).toMatch(/input VAT/i);
    expect(inInput.label).toMatch(/input tax credit/i);
    expect(saInput.amountMinor).toBe(inInput.amountMinor);
  });

  it("carries a negative net (refund) through as a signed amount", () => {
    const boxes = buildReturnBoxes(TAX_COUNTRY_PACKS.AE.boxes, {
      ...figures,
      inputTaxMinor: 20_000n,
      netTaxMinor: -5_000n,
    });
    expect(boxes.find((box) => box.source === "NET_TAX")!.amountMinor).toBe("-5000");
  });
});

describe("taxReturnAuditSchema", () => {
  it("accepts a well-formed audit payload", () => {
    const parsed = taxReturnAuditSchema.safeParse({
      summary: {
        countryCode: "SA",
        countryName: "Saudi Arabia",
        taxSystem: "VAT",
        taxAuthority: "ZATCA",
        returnName: "VAT Return",
        standardRatePpm: 150_000,
        baseCurrency: "SAR",
        currencyScale: 2,
        periodStart: "2026-01-01",
        periodEnd: "2026-03-31",
        currencies: [
          {
            currency: "SAR",
            currencyScale: 2,
            isBaseCurrency: true,
            outputTaxableBaseMinor: "100000",
            outputTaxMinor: "15000",
            inputTaxableBaseMinor: "40000",
            inputTaxMinor: "6000",
            netTaxMinor: "9000",
            netPosition: "PAYABLE",
            salesCount: 1,
            purchaseCount: 1,
            boxes: buildReturnBoxes(TAX_COUNTRY_PACKS.SA.boxes, {
              outputTaxableBaseMinor: 100_000n,
              outputTaxMinor: 15_000n,
              inputTaxableBaseMinor: 40_000n,
              inputTaxMinor: 6_000n,
              netTaxMinor: 9_000n,
            }),
          },
        ],
      },
      documents: [
        {
          id: "d1",
          direction: "OUTPUT",
          documentType: "INVOICE",
          number: "INV-1",
          issueDate: "2026-01-15",
          partyName: "Acme",
          currency: "SAR",
          currencyScale: 2,
          subtotalMinor: "100000",
          taxMinor: "15000",
          totalMinor: "115000",
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });
});
