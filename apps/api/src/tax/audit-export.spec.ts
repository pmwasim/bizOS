import { describe, expect, it } from "vitest";

import { type TaxReturnAudit, type TaxReturnDocument } from "@bizo/contracts/tax";

import { auditExportFilename, toAuditCsv } from "./audit-export.js";

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
