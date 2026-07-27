import { describe, expect, it } from "vitest";

import { createBusinessRequestSchema, updateBusinessSettingsRequestSchema } from "./platform.js";

describe("platform contracts", () => {
  it("applies simple defaults for a new business", () => {
    expect(
      createBusinessRequestSchema.parse({
        name: "Acme Services",
        countryCode: "sa",
        baseCurrency: "sar",
      }),
    ).toMatchObject({
      countryCode: "SA",
      baseCurrency: "SAR",
      currencyScale: 2,
      locale: "en",
      taxEnabled: false,
      taxRatePercent: "0",
    });
  });

  it("rejects unknown settings and unsafe quotation prefixes", () => {
    expect(() =>
      updateBusinessSettingsRequestSchema.parse({
        name: "Acme Services",
        legalName: null,
        email: null,
        phone: null,
        addressLine1: null,
        addressLine2: null,
        city: null,
        postalCode: null,
        countryCode: "SA",
        baseCurrency: "SAR",
        currencyScale: 2,
        locale: "en",
        timeZone: "Asia/Riyadh",
        quotationPrefix: "../Q",
        quotationValidityDays: 30,
        defaultMessage: null,
        taxEnabled: true,
        taxName: "VAT",
        taxRegistrationNumber: null,
        taxRatePercent: "15",
        unexpected: true,
      }),
    ).toThrow();
  });
});
