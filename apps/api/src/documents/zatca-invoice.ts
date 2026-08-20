/**
 * Map a finalized invoice snapshot to its ZATCA (Saudi e-invoicing) artefacts.
 *
 * Everything here is pure and deterministic: given an {@link InvoiceSnapshot} it produces the same
 * UBL 2.1 XML and the same Phase 1 QR TLV every time. The snapshot is the immutable record captured
 * when the invoice was finalized (see `DocumentVersion`), so the ZATCA output cannot drift from what
 * was actually issued.
 *
 * Timestamp note: bizOS invoices carry a civil issue *date* (`YYYY-MM-DD`), not an instant. ZATCA
 * expects an ISO-8601 date/time, so we anchor the time-of-day to `00:00:00Z` derived from the issue
 * date. This keeps generation deterministic from the snapshot; a future revision that stores the
 * finalization instant on the snapshot can supply a precise time without changing callers.
 */

import { encodeZatcaPhase1Qr } from "@bizo/contracts/zatca";
import {
  buildZatcaUblInvoiceXml,
  type ZatcaTaxCategory,
  type ZatcaUblLine,
  type ZatcaUblParty,
  type ZatcaUblTaxSubtotal,
} from "@bizo/contracts/zatca-ubl";

import { type InvoiceSnapshot } from "./invoice-snapshot.js";

/** The single country for which ZATCA e-invoicing applies. */
export const ZATCA_COUNTRY_CODE = "SA";

/** ZATCA-mandated tax currency. */
const ZATCA_TAX_CURRENCY = "SAR";

export class ZatcaInvoiceError extends Error {}

/** Case- and whitespace-insensitive check that a country is Saudi Arabia. */
export function isZatcaCountry(countryCode: string | null | undefined): boolean {
  return Boolean(countryCode) && countryCode!.trim().toUpperCase() === ZATCA_COUNTRY_CODE;
}

/** Convert a tax rate held in parts-per-million to a percent (150000 ppm → 15). */
function ppmToPercent(ppm: number): number {
  return ppm / 10_000;
}

/**
 * Map a line's rate to a ZATCA VAT category. MVP scope: a positive rate is standard-rated (`S`) and
 * a zero rate is treated as zero-rated (`Z`). Exempt (`E`) and out-of-scope (`O`) are not
 * distinguished because the invoice model carries only a numeric rate per line, not a category.
 */
function categoryForPpm(ppm: number): ZatcaTaxCategory {
  return ppm > 0 ? "S" : "Z";
}

export interface ZatcaSnapshotContext {
  snapshot: InvoiceSnapshot;
  /** The invoice's stable public id, used as the UBL `cbc:UUID`. */
  invoiceUuid: string;
  invoiceNumber: string;
  /**
   * Seller country resolved by the caller — the snapshot's business country when present, otherwise
   * the live business country. Guaranteed to be Saudi (`SA`) by the caller's fail-closed gate.
   */
  sellerCountryCode: string;
}

function zatcaStreetLines(party: {
  address?: string[];
  city?: string | null;
  postalCode?: string | null;
}): string[] {
  // `address` bundles a trailing "<city> <postal>" element; drop it so partyXml renders the city and
  // postal code from their dedicated fields rather than mislabelling them as an extra street line.
  const cityPostal = [party.city ?? "", party.postalCode ?? ""]
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .join(" ");
  return (party.address ?? []).filter((line) => cityPostal === "" || line.trim() !== cityPostal);
}

function resolveSeller(snapshot: InvoiceSnapshot, sellerCountryCode: string): ZatcaUblParty {
  const registrationName = (snapshot.business.legalName ?? snapshot.business.name).trim();
  const vatNumber = snapshot.business.taxRegistrationNumber?.trim();
  if (!vatNumber) {
    throw new ZatcaInvoiceError(
      "The selling business has no VAT registration number; a ZATCA tax invoice cannot be issued.",
    );
  }
  return {
    registrationName,
    vatNumber,
    countryCode: sellerCountryCode,
    addressLines: zatcaStreetLines(snapshot.business),
    city: snapshot.business.city ?? null,
    postalCode: snapshot.business.postalCode ?? null,
  };
}

function resolveBuyer(snapshot: InvoiceSnapshot): ZatcaUblParty {
  // Never fabricate the buyer's country: an unrecorded country is omitted (an optional UBL field)
  // rather than defaulted to the seller's SA, which would misrepresent foreign/export customers and
  // can change the tax interpretation of the invoice.
  return {
    registrationName: snapshot.customer.name.trim(),
    // Buyer VAT is not modelled on the customer record; omitted for B2C/simplified invoices.
    countryCode: snapshot.customer.countryCode?.trim() || null,
    addressLines: zatcaStreetLines(snapshot.customer),
    city: snapshot.customer.city ?? null,
    postalCode: snapshot.customer.postalCode ?? null,
  };
}

interface SubtotalAccumulator {
  taxableMinor: bigint;
  taxMinor: bigint;
  category: ZatcaTaxCategory;
  percent: number;
}

function buildLinesAndSubtotals(snapshot: InvoiceSnapshot): {
  lines: ZatcaUblLine[];
  subtotals: ZatcaUblTaxSubtotal[];
} {
  const groups = new Map<number, SubtotalAccumulator>();
  const lines: ZatcaUblLine[] = snapshot.lines
    .slice()
    .sort((left, right) => left.position - right.position)
    .map((line, index) => {
      const percent = ppmToPercent(line.taxRatePpm);
      const category = categoryForPpm(line.taxRatePpm);
      const existing = groups.get(line.taxRatePpm);
      if (existing) {
        existing.taxableMinor += BigInt(line.subtotalMinor);
        existing.taxMinor += BigInt(line.taxMinor);
      } else {
        groups.set(line.taxRatePpm, {
          taxableMinor: BigInt(line.subtotalMinor),
          taxMinor: BigInt(line.taxMinor),
          category,
          percent,
        });
      }
      return {
        id: index + 1,
        name: line.description,
        quantity: line.quantity,
        unitPriceMinor: line.unitPriceMinor,
        lineExtensionMinor: line.subtotalMinor,
        taxAmountMinor: line.taxMinor,
        taxCategory: category,
        taxPercent: percent,
      } satisfies ZatcaUblLine;
    });

  const subtotals: ZatcaUblTaxSubtotal[] = [...groups.entries()]
    // Deterministic order by rate so the output never depends on line iteration order.
    .sort(([leftPpm], [rightPpm]) => leftPpm - rightPpm)
    .map(([, accumulator]) => ({
      taxableAmountMinor: accumulator.taxableMinor.toString(),
      taxAmountMinor: accumulator.taxMinor.toString(),
      taxCategory: accumulator.category,
      taxPercent: accumulator.percent,
    }));

  return { lines, subtotals };
}

/** ZATCA issue instant derived from the snapshot's civil issue date (anchored at 00:00:00Z). */
export function zatcaIssuedAt(snapshot: InvoiceSnapshot): Date {
  return new Date(`${snapshot.issueDate}T00:00:00.000Z`);
}

/** Build the UBL 2.1 tax-invoice XML for a finalized SA invoice snapshot. */
export function buildZatcaXmlFromSnapshot(context: ZatcaSnapshotContext): string {
  const { snapshot } = context;
  const { lines, subtotals } = buildLinesAndSubtotals(snapshot);
  const issuedAt = zatcaIssuedAt(snapshot);
  return buildZatcaUblInvoiceXml({
    invoiceNumber: context.invoiceNumber,
    uuid: context.invoiceUuid,
    issueDate: snapshot.issueDate,
    issueTime: issuedAt.toISOString().slice(11, 19),
    invoiceTypeName: "0100000",
    currency: snapshot.currencyCode,
    taxCurrency: ZATCA_TAX_CURRENCY,
    currencyScale: snapshot.currencyScale,
    seller: resolveSeller(snapshot, context.sellerCountryCode),
    buyer: resolveBuyer(snapshot),
    lines,
    taxSubtotals: subtotals,
    lineExtensionMinor: snapshot.subtotalMinor,
    taxExclusiveMinor: snapshot.subtotalMinor,
    taxInclusiveMinor: snapshot.totalMinor,
    payableMinor: snapshot.totalMinor,
    taxTotalMinor: snapshot.taxMinor,
  });
}

/** Build the Phase 1 QR TLV base64 string (5 mandatory tags) for a finalized SA invoice snapshot. */
export function buildZatcaQrFromSnapshot(context: ZatcaSnapshotContext): string {
  const { snapshot } = context;
  const sellerName = (snapshot.business.legalName ?? snapshot.business.name).trim();
  const vatNumber = snapshot.business.taxRegistrationNumber?.trim();
  if (!vatNumber) {
    throw new ZatcaInvoiceError(
      "The selling business has no VAT registration number; a ZATCA QR cannot be generated.",
    );
  }
  return encodeZatcaPhase1Qr({
    sellerName,
    vatRegistrationNumber: vatNumber,
    issuedAt: zatcaIssuedAt(snapshot),
    totalWithVatMinor: snapshot.totalMinor,
    vatTotalMinor: snapshot.taxMinor,
    currencyScale: snapshot.currencyScale,
  });
}
