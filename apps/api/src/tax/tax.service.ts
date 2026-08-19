import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import {
  buildReturnBoxes,
  netPositionForMinor,
  resolveTaxCountryPack,
  type TaxCountryPack,
  type TaxCurrencySummary,
  type TaxReturnAudit,
  type TaxReturnDocument,
  type TaxReturnQuery,
} from "@bizo/contracts/tax";
import { DocumentStatus, DocumentType } from "@bizo/database";

import { DatabaseService } from "../database/database.service.js";
import { BusinessAccessService } from "../security/business-access.service.js";

type TransactionLike = Parameters<Parameters<DatabaseService["withScope"]>[1]>[0];

interface DecimalLike {
  toString(): string;
}

interface DocumentRow {
  publicId: string;
  number: string;
  issueDate: Date;
  currencyCode: string;
  currencyScale: number;
  subtotalMinor: DecimalLike;
  taxMinor: DecimalLike;
  totalMinor: DecimalLike;
  customer: { name: string } | null;
  supplier: { name: string } | null;
}

interface BusinessRow {
  countryCode: string;
  baseCurrency: string;
  currencyScale: number;
}

/** Running per-currency totals, kept as BigInt so minor units never round (ADR-0008). */
interface CurrencyAccumulator {
  currency: string;
  currencyScale: number;
  outputTaxableBaseMinor: bigint;
  outputTaxMinor: bigint;
  inputTaxableBaseMinor: bigint;
  inputTaxMinor: bigint;
  salesCount: number;
  purchaseCount: number;
}

/**
 * A tax return, derived on read.
 *
 * Output tax is the VAT/GST on SENT customer invoices; input tax is the VAT/GST on APPROVED supplier
 * bills. The net for a currency is `output − input`. Nothing is stored — the figures come straight
 * from each document's own `taxMinor` (never recomputed from a rate, so zero-rated and exempt lines
 * are honoured exactly), and no cross-currency arithmetic happens anywhere (ADR-0024).
 *
 * **Why status SENT selects APPROVED bills.** A `DocumentStatus` is shared across document types; a
 * supplier bill has no separate approval column. `ProcurementService.mapBillStatus` is the single
 * authority on how the enum reads for a bill: DRAFT→"DRAFT", **SENT→"APPROVED"**, ARCHIVED→
 * "CANCELLED". So an APPROVED bill is precisely a `SUPPLIER_BILL` at `DocumentStatus.SENT`, and that
 * is what feeds input tax. A DRAFT (unapproved) bill is deliberately excluded.
 */
@Injectable()
export class TaxSummaryService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(BusinessAccessService) private readonly businessAccess: BusinessAccessService,
  ) {}

  async taxReturn(
    userPublicId: string,
    businessPublicId: string,
    query: TaxReturnQuery = {},
  ): Promise<TaxReturnAudit> {
    const access = await this.businessAccess.resolve(userPublicId, businessPublicId);
    // A tax return is a read over invoices and bills; the invoices read capability gates it, the same
    // one the accountant and external-auditor roles already carry.
    await this.businessAccess.assertAllowed(access, "invoices", "read");

    return this.database.withScope(access, async (transaction) => {
      const business = await this.readBusiness(transaction, access.businessId);

      const pack = resolveTaxCountryPack(business.countryCode);
      if (!pack) {
        // Fail closed: without a shipped country pack there is no defined regime to report, so we
        // refuse rather than invent boxes or a rate for a country bizOS does not model.
        throw new BadRequestException({
          code: "TAX_COUNTRY_UNSUPPORTED",
          detail: `A tax return is not available for country "${business.countryCode}".`,
        });
      }

      const issueDateFilter = this.issueDateFilter(query);

      const [invoices, bills] = await Promise.all([
        this.readDocuments(transaction, access.businessId, DocumentType.INVOICE, issueDateFilter),
        this.readDocuments(
          transaction,
          access.businessId,
          DocumentType.SUPPLIER_BILL,
          issueDateFilter,
        ),
      ]);

      const accumulators = new Map<string, CurrencyAccumulator>();
      const documents: TaxReturnDocument[] = [];

      for (const invoice of invoices) {
        const accumulator = this.accumulatorFor(accumulators, invoice);
        accumulator.outputTaxableBaseMinor += BigInt(invoice.subtotalMinor.toString());
        accumulator.outputTaxMinor += BigInt(invoice.taxMinor.toString());
        accumulator.salesCount += 1;
        documents.push(this.auditDocument(invoice, "OUTPUT", "INVOICE"));
      }

      for (const bill of bills) {
        const accumulator = this.accumulatorFor(accumulators, bill);
        accumulator.inputTaxableBaseMinor += BigInt(bill.subtotalMinor.toString());
        accumulator.inputTaxMinor += BigInt(bill.taxMinor.toString());
        accumulator.purchaseCount += 1;
        documents.push(this.auditDocument(bill, "INPUT", "SUPPLIER_BILL"));
      }

      const currencies = this.summariseCurrencies(accumulators, pack, business.baseCurrency);

      return {
        summary: {
          countryCode: pack.countryCode,
          countryName: pack.countryName,
          taxSystem: pack.taxSystem,
          taxAuthority: pack.taxAuthority,
          returnName: pack.returnName,
          standardRatePpm: pack.standardRatePpm,
          baseCurrency: business.baseCurrency,
          currencyScale: business.currencyScale,
          periodStart: query.startDate ?? null,
          periodEnd: query.endDate ?? null,
          currencies,
        },
        documents: this.sortDocuments(documents),
      } satisfies TaxReturnAudit;
    });
  }

  private summariseCurrencies(
    accumulators: Map<string, CurrencyAccumulator>,
    pack: TaxCountryPack,
    baseCurrency: string,
  ): TaxCurrencySummary[] {
    return (
      [...accumulators.values()]
        .map((accumulator): TaxCurrencySummary => {
          const netTaxMinor = accumulator.outputTaxMinor - accumulator.inputTaxMinor;
          const figures = {
            outputTaxableBaseMinor: accumulator.outputTaxableBaseMinor,
            outputTaxMinor: accumulator.outputTaxMinor,
            inputTaxableBaseMinor: accumulator.inputTaxableBaseMinor,
            inputTaxMinor: accumulator.inputTaxMinor,
            netTaxMinor,
          };
          return {
            currency: accumulator.currency,
            currencyScale: accumulator.currencyScale,
            isBaseCurrency: accumulator.currency === baseCurrency,
            outputTaxableBaseMinor: accumulator.outputTaxableBaseMinor.toString(),
            outputTaxMinor: accumulator.outputTaxMinor.toString(),
            inputTaxableBaseMinor: accumulator.inputTaxableBaseMinor.toString(),
            inputTaxMinor: accumulator.inputTaxMinor.toString(),
            netTaxMinor: netTaxMinor.toString(),
            netPosition: netPositionForMinor(netTaxMinor),
            salesCount: accumulator.salesCount,
            purchaseCount: accumulator.purchaseCount,
            boxes: buildReturnBoxes(pack.boxes, figures),
          };
        })
        // The base currency leads; every other currency follows alphabetically as its own block. Order
        // is deterministic so the preview and export never depend on database row order.
        .sort((left, right) => {
          if (left.isBaseCurrency !== right.isBaseCurrency) return left.isBaseCurrency ? -1 : 1;
          return left.currency.localeCompare(right.currency);
        })
    );
  }

  private accumulatorFor(
    accumulators: Map<string, CurrencyAccumulator>,
    document: DocumentRow,
  ): CurrencyAccumulator {
    const existing = accumulators.get(document.currencyCode);
    if (existing) return existing;
    const created: CurrencyAccumulator = {
      currency: document.currencyCode,
      currencyScale: document.currencyScale,
      outputTaxableBaseMinor: 0n,
      outputTaxMinor: 0n,
      inputTaxableBaseMinor: 0n,
      inputTaxMinor: 0n,
      salesCount: 0,
      purchaseCount: 0,
    };
    accumulators.set(document.currencyCode, created);
    return created;
  }

  private auditDocument(
    document: DocumentRow,
    direction: TaxReturnDocument["direction"],
    documentType: TaxReturnDocument["documentType"],
  ): TaxReturnDocument {
    return {
      id: document.publicId,
      direction,
      documentType,
      number: document.number,
      issueDate: toDateOnly(document.issueDate),
      partyName:
        direction === "OUTPUT"
          ? (document.customer?.name ?? "Unknown customer")
          : (document.supplier?.name ?? "Unknown supplier"),
      currency: document.currencyCode,
      currencyScale: document.currencyScale,
      subtotalMinor: document.subtotalMinor.toString(),
      taxMinor: document.taxMinor.toString(),
      totalMinor: document.totalMinor.toString(),
    };
  }

  private sortDocuments(documents: TaxReturnDocument[]): TaxReturnDocument[] {
    return documents.sort(
      (left, right) =>
        left.direction.localeCompare(right.direction) ||
        left.issueDate.localeCompare(right.issueDate) ||
        left.number.localeCompare(right.number),
    );
  }

  private issueDateFilter(query: TaxReturnQuery): { gte?: Date; lte?: Date } | undefined {
    const filter: { gte?: Date; lte?: Date } = {};
    if (query.startDate) filter.gte = new Date(`${query.startDate}T00:00:00.000Z`);
    if (query.endDate) filter.lte = new Date(`${query.endDate}T00:00:00.000Z`);
    return filter.gte || filter.lte ? filter : undefined;
  }

  private async readDocuments(
    transaction: TransactionLike,
    businessId: bigint,
    type: DocumentType,
    issueDate: { gte?: Date; lte?: Date } | undefined,
  ): Promise<DocumentRow[]> {
    return (await transaction.document.findMany({
      where: {
        businessId,
        type,
        // Output tax comes from SENT invoices; input tax from SENT (= APPROVED) supplier bills.
        status: DocumentStatus.SENT,
        ...(issueDate ? { issueDate } : {}),
      },
      select: {
        publicId: true,
        number: true,
        issueDate: true,
        currencyCode: true,
        currencyScale: true,
        subtotalMinor: true,
        taxMinor: true,
        totalMinor: true,
        customer: { select: { name: true } },
        supplier: { select: { name: true } },
      },
      orderBy: { issueDate: "asc" },
    })) as unknown as DocumentRow[];
  }

  private async readBusiness(
    transaction: TransactionLike,
    businessId: bigint,
  ): Promise<BusinessRow> {
    const business = (await transaction.business.findFirst({
      where: { id: businessId },
      select: { countryCode: true, baseCurrency: true, currencyScale: true },
    })) as BusinessRow | null;

    if (!business) {
      throw new NotFoundException({
        code: "BUSINESS_NOT_FOUND",
        detail: "That business does not exist.",
      });
    }

    return business;
  }
}

/** A stored `@db.Date` back to `YYYY-MM-DD`, read in UTC so the civil date is not shifted by zone. */
function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}
