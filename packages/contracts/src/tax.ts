import { z } from "zod";

/**
 * Country Tax Summary & VAT/GST return preparation contracts (MVP Module 9).
 *
 * A tax return is *derived on read* from the documents a business has already recorded — never a
 * stored artefact. Output tax comes from SENT customer invoices, input tax from APPROVED supplier
 * bills, and the net payable/refundable is simply `output − input`, computed per currency and
 * fail-closed: figures for different currencies are never summed at an implied rate (ADR-0024), and
 * money is carried as integer minor-unit strings throughout (ADR-0008).
 *
 * The aggregation is identical for every country. A *country pack* only changes how the same two
 * figures are named and presented: the tax system (VAT vs GST), the administering authority, the
 * headline standard rate, and the labelled boxes of that country's return form.
 */

/** `YYYY-MM-DD`. A return covers whole civil days, never instants. */
const dateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.");

const currencySchema = z.string().trim().length(3).toUpperCase();
const currencyScaleSchema = z.number().int().min(0).max(6);

/**
 * A monetary amount in integer minor units, encoded as a decimal string (ADR-0008).
 *
 * `minorUnitsSchema` is signed — a net position can be negative (a refund) — and is parsed with
 * `BigInt` wherever arithmetic is needed, so a value above `Number.MAX_SAFE_INTEGER` never rounds
 * silently across the wire. `nonNegativeMinorUnitsSchema` is for figures that cannot be negative,
 * such as an output-tax total or a taxable base.
 */
const minorUnitsSchema = z.string().regex(/^-?\d+$/, "Use an integer number of minor units.");
const nonNegativeMinorUnitsSchema = z
  .string()
  .regex(/^\d+$/, "Use a non-negative integer number of minor units.");

/** The country packs bizOS ships. Anything else fails closed rather than guessing a regime. */
export const taxCountryCodeSchema = z.enum(["SA", "AE", "IN"]);
export type TaxCountryCode = z.infer<typeof taxCountryCodeSchema>;

export const taxSystemSchema = z.enum(["VAT", "GST"]);
export type TaxSystem = z.infer<typeof taxSystemSchema>;

/**
 * One box of a country's return form.
 *
 * `source` binds the box to a figure in the per-currency aggregation rather than a literal amount,
 * so the same pack definition produces correct boxes for every currency and every period. That is
 * what makes a country pack pure data: it never computes, it only labels.
 */
export const taxBoxSourceSchema = z.enum([
  "OUTPUT_BASE",
  "OUTPUT_TAX",
  "INPUT_BASE",
  "INPUT_TAX",
  "NET_TAX",
]);
export type TaxBoxSource = z.infer<typeof taxBoxSourceSchema>;

export const taxBoxDefinitionSchema = z.object({
  code: z.string(),
  label: z.string(),
  source: taxBoxSourceSchema,
});
export type TaxBoxDefinition = z.infer<typeof taxBoxDefinitionSchema>;

/** A rendered return box: a definition resolved to an amount for one currency (signed for NET_TAX). */
export const taxBoxSchema = z.object({
  code: z.string(),
  label: z.string(),
  source: taxBoxSourceSchema,
  amountMinor: minorUnitsSchema,
});
export type TaxBox = z.infer<typeof taxBoxSchema>;

/**
 * A country pack: the presentation layer over a regime-agnostic aggregation.
 *
 * `standardRatePpm` is the headline rate in parts-per-million (15% ZATCA VAT = 150000, 5% FTA VAT =
 * 50000). It is metadata for the preview header — the actual tax on every document is read from that
 * document's stored `taxMinor`, never recomputed from this rate, so a zero-rated or exempt line is
 * honoured exactly as it was recorded.
 */
export const taxCountryPackSchema = z.object({
  countryCode: taxCountryCodeSchema,
  countryName: z.string(),
  taxSystem: taxSystemSchema,
  taxAuthority: z.string(),
  returnName: z.string(),
  standardRatePpm: z.number().int().min(0).max(1_000_000),
  boxes: z.array(taxBoxDefinitionSchema).min(1),
});
export type TaxCountryPack = z.infer<typeof taxCountryPackSchema>;

/**
 * The three country packs. Aggregation is shared; only the labels differ.
 *
 * - **SA** — ZATCA VAT at 15%. The return nets output VAT due against deductible input VAT.
 * - **AE** — Federal Tax Authority VAT at 5%. Standard-rated supplies against recoverable expenses.
 * - **IN** — GST. "Input tax credit" (ITC) is the input-side term; the headline standard slab is 18%.
 *   A single stored `taxMinor` cannot tell CGST/SGST from IGST after the fact, so the MVP return
 *   reports the combined GST movement rather than inventing a place-of-supply split.
 */
export const TAX_COUNTRY_PACKS: Record<TaxCountryCode, TaxCountryPack> = {
  SA: {
    countryCode: "SA",
    countryName: "Saudi Arabia",
    taxSystem: "VAT",
    taxAuthority: "ZATCA",
    returnName: "VAT Return",
    standardRatePpm: 150_000,
    boxes: [
      { code: "1", label: "Standard-rated sales", source: "OUTPUT_BASE" },
      { code: "1-VAT", label: "Output VAT due", source: "OUTPUT_TAX" },
      { code: "7", label: "Standard-rated purchases", source: "INPUT_BASE" },
      { code: "7-VAT", label: "Deductible input VAT", source: "INPUT_TAX" },
      { code: "14", label: "Net VAT due", source: "NET_TAX" },
    ],
  },
  AE: {
    countryCode: "AE",
    countryName: "United Arab Emirates",
    taxSystem: "VAT",
    taxAuthority: "Federal Tax Authority",
    returnName: "VAT 201 Return",
    standardRatePpm: 50_000,
    boxes: [
      { code: "1a", label: "Standard-rated supplies", source: "OUTPUT_BASE" },
      { code: "1a-VAT", label: "Output VAT", source: "OUTPUT_TAX" },
      { code: "9", label: "Standard-rated expenses", source: "INPUT_BASE" },
      { code: "9-VAT", label: "Recoverable input VAT", source: "INPUT_TAX" },
      { code: "12", label: "Net VAT payable", source: "NET_TAX" },
    ],
  },
  IN: {
    countryCode: "IN",
    countryName: "India",
    taxSystem: "GST",
    taxAuthority: "GSTN",
    returnName: "GSTR-3B Summary",
    standardRatePpm: 180_000,
    boxes: [
      { code: "3.1(a)", label: "Outward taxable supplies", source: "OUTPUT_BASE" },
      { code: "3.1(a)-GST", label: "Output GST", source: "OUTPUT_TAX" },
      { code: "4(A)", label: "Inward supplies (ITC base)", source: "INPUT_BASE" },
      { code: "4(A)-GST", label: "Eligible input tax credit", source: "INPUT_TAX" },
      { code: "5.1", label: "Net GST payable", source: "NET_TAX" },
    ],
  },
};

/** Whether a business's country has a shipped tax pack. Fail closed for anything else. */
export function resolveTaxCountryPack(countryCode: string): TaxCountryPack | null {
  const parsed = taxCountryCodeSchema.safeParse(countryCode);
  return parsed.success ? TAX_COUNTRY_PACKS[parsed.data] : null;
}

/** Where a document sits in the return: it raised output tax, or it carried recoverable input tax. */
export const taxDirectionSchema = z.enum(["OUTPUT", "INPUT"]);
export type TaxDirection = z.infer<typeof taxDirectionSchema>;

/** How a currency's net position reads: money owed to the authority, owed back, or square. */
export const netPositionSchema = z.enum(["PAYABLE", "REFUNDABLE", "NIL"]);
export type NetPosition = z.infer<typeof netPositionSchema>;

/**
 * The aggregation for a single currency — the heart of the return.
 *
 * `netTaxMinor = outputTaxMinor − inputTaxMinor`, signed: positive is payable to the authority,
 * negative is refundable. Everything here is confined to one currency; the summary carries an array
 * of these and never adds across them.
 */
export const taxCurrencySummarySchema = z.object({
  currency: currencySchema,
  currencyScale: currencyScaleSchema,
  isBaseCurrency: z.boolean(),
  outputTaxableBaseMinor: nonNegativeMinorUnitsSchema,
  outputTaxMinor: nonNegativeMinorUnitsSchema,
  inputTaxableBaseMinor: nonNegativeMinorUnitsSchema,
  inputTaxMinor: nonNegativeMinorUnitsSchema,
  netTaxMinor: minorUnitsSchema,
  netPosition: netPositionSchema,
  salesCount: z.number().int().nonnegative(),
  purchaseCount: z.number().int().nonnegative(),
  boxes: z.array(taxBoxSchema),
});
export type TaxCurrencySummary = z.infer<typeof taxCurrencySummarySchema>;

/**
 * A tax return preview: the country pack, the period, and the per-currency net positions.
 *
 * The base currency's block sorts first; every other currency follows alphabetically as its own
 * self-contained block. There is no "otherCurrencies excluded" list because nothing is excluded —
 * each currency is reported in full on its own terms, which is what per-currency fail-closed means
 * here (as opposed to a single-currency total that has to name what it dropped).
 */
export const taxReturnSummarySchema = z.object({
  countryCode: taxCountryCodeSchema,
  countryName: z.string(),
  taxSystem: taxSystemSchema,
  taxAuthority: z.string(),
  returnName: z.string(),
  standardRatePpm: z.number().int().min(0).max(1_000_000),
  baseCurrency: currencySchema,
  currencyScale: currencyScaleSchema,
  periodStart: dateOnlySchema.nullable(),
  periodEnd: dateOnlySchema.nullable(),
  currencies: z.array(taxCurrencySummarySchema),
});
export type TaxReturnSummary = z.infer<typeof taxReturnSummarySchema>;

/**
 * One document feeding a return box — the audit trail behind every figure.
 *
 * These are the SENT invoices and APPROVED bills the aggregation summed. Exporting them lets a
 * preparer reconcile each box back to the source documents rather than trusting an opaque total.
 */
export const taxReturnDocumentSchema = z.object({
  id: z.string(),
  direction: taxDirectionSchema,
  documentType: z.enum(["INVOICE", "SUPPLIER_BILL"]),
  number: z.string(),
  issueDate: dateOnlySchema,
  partyName: z.string(),
  currency: currencySchema,
  currencyScale: currencyScaleSchema,
  subtotalMinor: nonNegativeMinorUnitsSchema,
  taxMinor: nonNegativeMinorUnitsSchema,
  totalMinor: nonNegativeMinorUnitsSchema,
});
export type TaxReturnDocument = z.infer<typeof taxReturnDocumentSchema>;

/** The preview plus the underlying documents — the payload behind both the page and the export. */
export const taxReturnAuditSchema = z.object({
  summary: taxReturnSummarySchema,
  documents: z.array(taxReturnDocumentSchema),
});
export type TaxReturnAudit = z.infer<typeof taxReturnAuditSchema>;

/** A reporting period: both ends optional, but a start may not fall after an end. */
const periodOrdered = (query: {
  startDate?: string | undefined;
  endDate?: string | undefined;
}): boolean => !query.startDate || !query.endDate || query.startDate <= query.endDate;

const taxPeriodShape = {
  startDate: dateOnlySchema.optional(),
  endDate: dateOnlySchema.optional(),
};

export const taxReturnQuerySchema = z
  .object(taxPeriodShape)
  .refine(periodOrdered, "The start date must not be after the end date.");
export type TaxReturnQuery = z.infer<typeof taxReturnQuerySchema>;

/** Audit export formats: a spreadsheet-friendly CSV or the raw JSON of the documents. */
export const taxExportFormatSchema = z.enum(["csv", "json"]);
export type TaxExportFormat = z.infer<typeof taxExportFormatSchema>;

export const taxExportQuerySchema = z
  .object({ ...taxPeriodShape, format: taxExportFormatSchema.default("csv") })
  .refine(periodOrdered, "The start date must not be after the end date.");
export type TaxExportQuery = z.infer<typeof taxExportQuerySchema>;

/** How a stored `netTaxMinor` reads as a position. Kept beside the schema so both sides agree. */
export function netPositionForMinor(netTaxMinor: bigint): NetPosition {
  if (netTaxMinor > 0n) return "PAYABLE";
  if (netTaxMinor < 0n) return "REFUNDABLE";
  return "NIL";
}

/**
 * Resolve a country pack's box definitions to amounts for one currency's aggregation.
 *
 * Pure and total: every box maps its `source` to the matching figure, so the boxes always reconcile
 * to the summary they were built from. This is the single place the pack's labels meet the numbers.
 */
export function buildReturnBoxes(
  boxes: readonly TaxBoxDefinition[],
  figures: {
    outputTaxableBaseMinor: bigint;
    outputTaxMinor: bigint;
    inputTaxableBaseMinor: bigint;
    inputTaxMinor: bigint;
    netTaxMinor: bigint;
  },
): TaxBox[] {
  const bySource: Record<TaxBoxSource, bigint> = {
    OUTPUT_BASE: figures.outputTaxableBaseMinor,
    OUTPUT_TAX: figures.outputTaxMinor,
    INPUT_BASE: figures.inputTaxableBaseMinor,
    INPUT_TAX: figures.inputTaxMinor,
    NET_TAX: figures.netTaxMinor,
  };
  return boxes.map((box) => ({
    code: box.code,
    label: box.label,
    source: box.source,
    amountMinor: bySource[box.source].toString(),
  }));
}
