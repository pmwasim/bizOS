/**
 * ZATCA (Saudi Arabia) Phase 2 UBL 2.1 tax-invoice XML generation.
 *
 * ZATCA Phase 2 ("integration") mandates that every tax invoice be represented as an OASIS UBL 2.1
 * `Invoice` document, restricted by the ZATCA e-invoicing XML implementation standard. This module
 * builds that XML deterministically from a finalized invoice's snapshot — no clock, no randomness,
 * no I/O — so the same invoice always serialises to byte-identical XML.
 *
 * Scope boundary — this produces the *unsigned* UBL document (the invoice content ZATCA calls the
 * "tax invoice"). It deliberately does NOT carry the Phase 2 cryptographic stamp: there is no
 * `UBLExtensions`/`ds:Signature` block, no signed-properties hash, no invoice hash chaining (PIH),
 * and no CSID from the Fatoora onboarding CSR. Those require a device certificate and the ZATCA
 * compliance API and are tracked as a follow-up (see the API's ZATCA endpoint documentation). The
 * document is standards-faithful in structure and totals; it is not a cleared/reported invoice.
 *
 * Money is carried end to end as integer minor-unit strings (ADR-0008) and only rendered to the
 * UBL-required decimal form ("100.00") at serialisation via {@link formatMinorForZatca}, so no tax
 * figure ever passes through a float.
 *
 * Reference: ZATCA E-Invoicing — Electronic Invoice XML Implementation Standard (UBL 2.1).
 */

import { formatMinorForZatca } from "./zatca.js";

/**
 * VAT category codes used on the ZATCA UBL invoice. A subset of UN/CEFACT 5305:
 * - `S` — standard rate (15% in KSA)
 * - `Z` — zero-rated
 * - `E` — exempt
 * - `O` — out of scope / not subject to VAT
 */
export type ZatcaTaxCategory = "S" | "Z" | "E" | "O";

export interface ZatcaUblParty {
  /** Legal registered name of the party. */
  registrationName: string;
  /** VAT registration number, when the party has one (always present for the seller). */
  vatNumber?: string | null;
  /** ISO 3166-1 alpha-2 country code, for example `SA`. */
  countryCode: string;
  addressLines?: string[];
  city?: string | null;
  postalCode?: string | null;
}

export interface ZatcaUblLine {
  /** 1-based line number, rendered as `cbc:ID`. */
  id: number;
  name: string;
  /** Invoiced quantity as a plain decimal string, for example `2` or `1.5`. */
  quantity: string;
  /** UN/ECE Rec 20 unit code. Defaults to `PCE` (piece). */
  unitCode?: string;
  /** Unit price in minor units. */
  unitPriceMinor: bigint | string;
  /** Line net amount (quantity × unit price), in minor units — the `LineExtensionAmount`. */
  lineExtensionMinor: bigint | string;
  /** VAT on the line, in minor units. */
  taxAmountMinor: bigint | string;
  taxCategory: ZatcaTaxCategory;
  /** VAT percent as a number, for example `15` or `0`. */
  taxPercent: number;
}

export interface ZatcaUblTaxSubtotal {
  /** Net taxable base for this category/rate, in minor units. */
  taxableAmountMinor: bigint | string;
  /** VAT for this category/rate, in minor units. */
  taxAmountMinor: bigint | string;
  taxCategory: ZatcaTaxCategory;
  taxPercent: number;
}

export interface ZatcaUblInvoiceInput {
  /** ZATCA profile id. Defaults to `reporting:1.0`. */
  profileId?: string;
  /** Human invoice number (`cbc:ID`). */
  invoiceNumber: string;
  /** Stable UUID for the invoice (`cbc:UUID`). */
  uuid: string;
  /** Issue date `YYYY-MM-DD`. */
  issueDate: string;
  /** Issue time `HH:MM:SS`. */
  issueTime: string;
  /** UN/CEFACT 1001 document type code. `388` = tax invoice. */
  invoiceTypeCode?: string;
  /** ZATCA sub-type "name" attribute on the type code (e.g. `0100000`). */
  invoiceTypeName?: string;
  /** ISO 4217 document currency, for example `SAR`. */
  currency: string;
  /** ISO 4217 tax currency. ZATCA requires `SAR`; defaults to {@link ZatcaUblInvoiceInput.currency}. */
  taxCurrency?: string;
  /** Minor units per major unit exponent. SAR uses 2. */
  currencyScale: number;
  seller: ZatcaUblParty;
  buyer: ZatcaUblParty;
  lines: ZatcaUblLine[];
  taxSubtotals: ZatcaUblTaxSubtotal[];
  /** Sum of line net amounts, in minor units. */
  lineExtensionMinor: bigint | string;
  /** Total excluding VAT, in minor units. */
  taxExclusiveMinor: bigint | string;
  /** Total including VAT, in minor units. */
  taxInclusiveMinor: bigint | string;
  /** Amount payable, in minor units. */
  payableMinor: bigint | string;
  /** Total VAT, in minor units. */
  taxTotalMinor: bigint | string;
}

export class ZatcaUblError extends Error {}

/** Escape a string for use as XML character data or an attribute value. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Render a VAT percent as a plain decimal string, trimming trailing zeros (`15`, `5`, `0`). */
export function formatTaxPercent(percent: number): string {
  if (!Number.isFinite(percent) || percent < 0) {
    throw new ZatcaUblError(`Invalid VAT percent ${percent}.`);
  }
  const fixed = percent.toFixed(2);
  return fixed.replace(/\.?0+$/, "") || "0";
}

const VAT_SCHEME_ID = "VAT";

function amount(minor: bigint | string, scale: number): string {
  return formatMinorForZatca(minor, scale);
}

function partyXml(party: ZatcaUblParty, scale: number): string {
  void scale;
  const name = party.registrationName.trim();
  if (!name) {
    throw new ZatcaUblError("Party registration name is required.");
  }
  const country = party.countryCode.trim().toUpperCase();
  if (!country) {
    throw new ZatcaUblError("Party country code is required.");
  }
  const streetLines = (party.addressLines ?? [])
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const postalAddressChildren: string[] = [];
  if (streetLines[0]) {
    postalAddressChildren.push(`<cbc:StreetName>${escapeXml(streetLines[0])}</cbc:StreetName>`);
  }
  if (streetLines[1]) {
    postalAddressChildren.push(
      `<cbc:AdditionalStreetName>${escapeXml(streetLines[1])}</cbc:AdditionalStreetName>`,
    );
  }
  if (party.city && party.city.trim()) {
    postalAddressChildren.push(`<cbc:CityName>${escapeXml(party.city.trim())}</cbc:CityName>`);
  }
  if (party.postalCode && party.postalCode.trim()) {
    postalAddressChildren.push(
      `<cbc:PostalZone>${escapeXml(party.postalCode.trim())}</cbc:PostalZone>`,
    );
  }
  postalAddressChildren.push(
    `<cac:Country><cbc:IdentificationCode>${escapeXml(country)}</cbc:IdentificationCode></cac:Country>`,
  );

  const taxScheme = party.vatNumber?.trim()
    ? `<cac:PartyTaxScheme>` +
      `<cbc:CompanyID>${escapeXml(party.vatNumber.trim())}</cbc:CompanyID>` +
      `<cac:TaxScheme><cbc:ID>${VAT_SCHEME_ID}</cbc:ID></cac:TaxScheme>` +
      `</cac:PartyTaxScheme>`
    : "";

  return (
    `<cac:Party>` +
    `<cac:PostalAddress>${postalAddressChildren.join("")}</cac:PostalAddress>` +
    taxScheme +
    `<cac:PartyLegalEntity><cbc:RegistrationName>${escapeXml(name)}</cbc:RegistrationName></cac:PartyLegalEntity>` +
    `</cac:Party>`
  );
}

function taxCategoryXml(category: ZatcaTaxCategory, percent: number): string {
  return (
    `<cac:TaxCategory>` +
    `<cbc:ID>${category}</cbc:ID>` +
    `<cbc:Percent>${formatTaxPercent(percent)}</cbc:Percent>` +
    `<cac:TaxScheme><cbc:ID>${VAT_SCHEME_ID}</cbc:ID></cac:TaxScheme>` +
    `</cac:TaxCategory>`
  );
}

function taxSubtotalXml(subtotal: ZatcaUblTaxSubtotal, currency: string, scale: number): string {
  return (
    `<cac:TaxSubtotal>` +
    `<cbc:TaxableAmount currencyID="${currency}">${amount(subtotal.taxableAmountMinor, scale)}</cbc:TaxableAmount>` +
    `<cbc:TaxAmount currencyID="${currency}">${amount(subtotal.taxAmountMinor, scale)}</cbc:TaxAmount>` +
    taxCategoryXml(subtotal.taxCategory, subtotal.taxPercent) +
    `</cac:TaxSubtotal>`
  );
}

function invoiceLineXml(line: ZatcaUblLine, currency: string, scale: number): string {
  const unitCode = line.unitCode?.trim() || "PCE";
  const lineExtension = amount(line.lineExtensionMinor, scale);
  const lineTax = amount(line.taxAmountMinor, scale);
  const roundingMinor =
    (typeof line.lineExtensionMinor === "bigint"
      ? line.lineExtensionMinor
      : BigInt(line.lineExtensionMinor)) +
    (typeof line.taxAmountMinor === "bigint" ? line.taxAmountMinor : BigInt(line.taxAmountMinor));
  return (
    `<cac:InvoiceLine>` +
    `<cbc:ID>${line.id}</cbc:ID>` +
    `<cbc:InvoicedQuantity unitCode="${escapeXml(unitCode)}">${escapeXml(line.quantity)}</cbc:InvoicedQuantity>` +
    `<cbc:LineExtensionAmount currencyID="${currency}">${lineExtension}</cbc:LineExtensionAmount>` +
    `<cac:TaxTotal>` +
    `<cbc:TaxAmount currencyID="${currency}">${lineTax}</cbc:TaxAmount>` +
    `<cbc:RoundingAmount currencyID="${currency}">${amount(roundingMinor, scale)}</cbc:RoundingAmount>` +
    `</cac:TaxTotal>` +
    `<cac:Item>` +
    `<cbc:Name>${escapeXml(line.name)}</cbc:Name>` +
    `<cac:ClassifiedTaxCategory>` +
    `<cbc:ID>${line.taxCategory}</cbc:ID>` +
    `<cbc:Percent>${formatTaxPercent(line.taxPercent)}</cbc:Percent>` +
    `<cac:TaxScheme><cbc:ID>${VAT_SCHEME_ID}</cbc:ID></cac:TaxScheme>` +
    `</cac:ClassifiedTaxCategory>` +
    `</cac:Item>` +
    `<cac:Price><cbc:PriceAmount currencyID="${currency}">${amount(line.unitPriceMinor, scale)}</cbc:PriceAmount></cac:Price>` +
    `</cac:InvoiceLine>`
  );
}

/**
 * Build the UBL 2.1 tax-invoice XML for a ZATCA invoice. Pure and deterministic: the output depends
 * only on {@link input}. Throws {@link ZatcaUblError} when a required field is missing.
 */
export function buildZatcaUblInvoiceXml(input: ZatcaUblInvoiceInput): string {
  if (!input.invoiceNumber.trim()) {
    throw new ZatcaUblError("Invoice number is required.");
  }
  if (!input.uuid.trim()) {
    throw new ZatcaUblError("Invoice UUID is required.");
  }
  if (!input.lines.length) {
    throw new ZatcaUblError("A ZATCA invoice must have at least one line.");
  }
  const scale = input.currencyScale;
  const currency = input.currency.trim().toUpperCase();
  if (!currency) {
    throw new ZatcaUblError("Document currency is required.");
  }
  const taxCurrency = (input.taxCurrency ?? currency).trim().toUpperCase();
  const profileId = input.profileId ?? "reporting:1.0";
  const typeCode = input.invoiceTypeCode ?? "388";

  const header =
    `<cbc:ProfileID>${escapeXml(profileId)}</cbc:ProfileID>` +
    `<cbc:ID>${escapeXml(input.invoiceNumber.trim())}</cbc:ID>` +
    `<cbc:UUID>${escapeXml(input.uuid.trim())}</cbc:UUID>` +
    `<cbc:IssueDate>${escapeXml(input.issueDate)}</cbc:IssueDate>` +
    `<cbc:IssueTime>${escapeXml(input.issueTime)}</cbc:IssueTime>` +
    (input.invoiceTypeName
      ? `<cbc:InvoiceTypeCode name="${escapeXml(input.invoiceTypeName)}">${escapeXml(typeCode)}</cbc:InvoiceTypeCode>`
      : `<cbc:InvoiceTypeCode>${escapeXml(typeCode)}</cbc:InvoiceTypeCode>`) +
    `<cbc:DocumentCurrencyCode>${currency}</cbc:DocumentCurrencyCode>` +
    `<cbc:TaxCurrencyCode>${taxCurrency}</cbc:TaxCurrencyCode>`;

  const parties =
    `<cac:AccountingSupplierParty>${partyXml(input.seller, scale)}</cac:AccountingSupplierParty>` +
    `<cac:AccountingCustomerParty>${partyXml(input.buyer, scale)}</cac:AccountingCustomerParty>`;

  const taxTotal =
    `<cac:TaxTotal>` +
    `<cbc:TaxAmount currencyID="${taxCurrency}">${amount(input.taxTotalMinor, scale)}</cbc:TaxAmount>` +
    input.taxSubtotals.map((subtotal) => taxSubtotalXml(subtotal, taxCurrency, scale)).join("") +
    `</cac:TaxTotal>`;

  const legalMonetaryTotal =
    `<cac:LegalMonetaryTotal>` +
    `<cbc:LineExtensionAmount currencyID="${currency}">${amount(input.lineExtensionMinor, scale)}</cbc:LineExtensionAmount>` +
    `<cbc:TaxExclusiveAmount currencyID="${currency}">${amount(input.taxExclusiveMinor, scale)}</cbc:TaxExclusiveAmount>` +
    `<cbc:TaxInclusiveAmount currencyID="${currency}">${amount(input.taxInclusiveMinor, scale)}</cbc:TaxInclusiveAmount>` +
    `<cbc:PayableAmount currencyID="${currency}">${amount(input.payableMinor, scale)}</cbc:PayableAmount>` +
    `</cac:LegalMonetaryTotal>`;

  const lines = input.lines.map((line) => invoiceLineXml(line, currency, scale)).join("");

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" ` +
    `xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" ` +
    `xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">` +
    header +
    parties +
    taxTotal +
    legalMonetaryTotal +
    lines +
    `</Invoice>`
  );
}
