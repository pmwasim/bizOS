import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import {
  type CustomerStatement,
  type ReceivableCustomer,
  type ReceivablesQuery,
  type ReceivablesSummary,
  type StatementLineItem,
  type StatementQuery,
} from "@bizo/contracts/statements";

import { DatabaseService } from "../database/database.service.js";
import {
  type AuthorizationAction,
  type BusinessAccessContext,
  BusinessAccessService,
} from "../security/business-access.service.js";
import {
  addBuckets,
  type AgeableInvoice,
  ageInvoices,
  compareMinorDesc,
  emptyAgeingBuckets,
  overdueTotal,
  sumMinor,
  toDateOnly,
} from "./ageing.js";

/**
 * Invoice and credit-note statuses that represent a document the customer has actually received.
 *
 * `DocumentStatus` has no PAID or PARTIAL member — settlement lives in `payment_allocations`, not
 * on the document (ADR-0023) — so "issued" is exactly SENT. DRAFT and READY_TO_SEND have not left
 * the business, SEND_FAILED never arrived, and ARCHIVED was withdrawn.
 */
const ISSUED_STATUSES = { in: ["SENT"] } as const;

/** The transaction handle `DatabaseService.withScope` hands to its callback. */
type TransactionLike = Parameters<Parameters<DatabaseService["withScope"]>[1]>[0];

/**
 * Minimal row shapes for the three ledger sources. The `where` clauses cast enum values through
 * `never`, which collapses Prisma's inference on the result, so the fields used here are named
 * explicitly rather than left implicitly `any`.
 */
interface DecimalLike {
  toString(): string;
}

interface InvoiceRow {
  publicId: string;
  number: string;
  issueDate: Date;
  dueDate: Date | null;
  currencyCode: string;
  totalMinor: DecimalLike;
  customer: { publicId: string; name: string } | null;
}

interface PaymentAllocationRow {
  publicId: string;
  amountMinor: DecimalLike;
  document: { publicId: string } | null;
  payment: { publicId: string; paymentDate: Date; reference: string | null };
}

interface CreditNoteAllocationRow {
  publicId: string;
  amountMinor: DecimalLike;
  invoice: { publicId: string };
  creditNote: { publicId: string; number: string; issueDate: Date };
}

interface BusinessCurrencyRow {
  baseCurrency: string;
  currencyScale: number;
}

/** A ledger entry before the running balance is applied. */
interface LedgerEntry {
  id: string;
  date: string;
  type: StatementLineItem["type"];
  referenceNumber: string;
  description: string;
  dueDate: string | null;
  debitMinor: bigint;
  creditMinor: bigint;
}

/** An issued invoice with everything applied against it, ready to be aged. */
interface SettledInvoice {
  publicId: string;
  number: string;
  issueDate: string;
  /** Due date, falling back to the issue date when the invoice has none. */
  payableFrom: string;
  customerPublicId: string;
  customerName: string;
  totalMinor: bigint;
  settledMinor: bigint;
}

interface LoadedLedger {
  invoices: SettledInvoice[];
  entries: LedgerEntry[];
  otherCurrencies: string[];
}

/**
 * Ties settle document-first, so a receipt never appears to pay a debt that does not exist yet, and
 * a credit note issued the same day as its invoice reads in the order it happened.
 */
const TYPE_ORDER: Record<StatementLineItem["type"], number> = {
  INVOICE: 0,
  CREDIT_NOTE: 1,
  PAYMENT: 2,
};

@Injectable()
export class StatementsService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(BusinessAccessService) private readonly businessAccess: BusinessAccessService,
  ) {}

  /**
   * Everything the business is owed, as of a date, with each customer's ageing.
   *
   * This is the per-business receivables query ADR-0023 left as a follow-up. Every figure is
   * derived on read from issued invoices and what has been applied against them; no settlement or
   * ageing value is stored, cached, or estimated.
   */
  async receivables(
    userPublicId: string,
    businessPublicId: string,
    query: ReceivablesQuery = {},
  ): Promise<ReceivablesSummary> {
    const access = await this.authorize(userPublicId, businessPublicId, "read");
    const asOf = query.asOf ?? today();

    return this.database.withScope(access, async (transaction) => {
      const { baseCurrency, currencyScale } = await this.readBusinessCurrency(
        transaction,
        access.businessId,
      );
      const { invoices, otherCurrencies } = await this.load(transaction, access.businessId, {
        baseCurrency,
        asOf,
      });

      const byCustomer = new Map<string, { name: string; ageable: AgeableInvoice[] }>();
      for (const invoice of invoices) {
        const ageable = toAgeable(invoice);
        if (ageable.outstandingMinor <= 0n) continue;
        const entry = byCustomer.get(invoice.customerPublicId) ?? {
          name: invoice.customerName,
          ageable: [],
        };
        entry.ageable.push(ageable);
        byCustomer.set(invoice.customerPublicId, entry);
      }

      const customers: ReceivableCustomer[] = [...byCustomer.entries()]
        .map(([customerId, entry]) => {
          const buckets = ageInvoices(entry.ageable, asOf);
          const outstandingMinor = entry.ageable.reduce(
            (sum, item) => sum + item.outstandingMinor,
            0n,
          );

          return {
            customerId,
            customerName: entry.name,
            outstandingMinor: outstandingMinor.toString(),
            overdueMinor: overdueTotal(buckets),
            openInvoiceCount: entry.ageable.length,
            oldestDueDate: entry.ageable.map((item) => item.dueDate).sort()[0] ?? null,
            buckets,
          };
        })
        // The business reads this list to decide who to call first, so the largest debt leads and
        // ties fall back to the name rather than to whichever row the database returned first.
        .sort(
          (left, right) =>
            compareMinorDesc(left.outstandingMinor, right.outstandingMinor) ||
            left.customerName.localeCompare(right.customerName),
        );

      const buckets = customers.reduce(
        (total, customer) => addBuckets(total, customer.buckets),
        emptyAgeingBuckets,
      );

      return {
        asOf,
        currency: baseCurrency,
        currencyScale,
        totalOutstandingMinor: sumMinor(customers.map((customer) => customer.outstandingMinor)),
        totalOverdueMinor: overdueTotal(buckets),
        buckets,
        customers,
        otherCurrencies,
      };
    });
  }

  /** One customer's ledger for a period, with the balance they carried into it. */
  async customer(
    userPublicId: string,
    businessPublicId: string,
    customerPublicId: string,
    query: StatementQuery = {},
  ): Promise<CustomerStatement> {
    const access = await this.authorize(userPublicId, businessPublicId, "read");
    const periodStart = query.startDate ?? null;
    const periodEnd = query.endDate ?? null;
    const asOf = periodEnd ?? today();

    return this.database.withScope(access, async (transaction) => {
      const customer = (await transaction.customer.findFirst({
        where: { businessId: access.businessId, publicId: customerPublicId },
      })) as { id: bigint; publicId: string; name: string } | null;

      if (!customer) {
        throw new NotFoundException({
          code: "CUSTOMER_NOT_FOUND",
          detail: "That customer does not exist in this business.",
        });
      }

      const { baseCurrency, currencyScale } = await this.readBusinessCurrency(
        transaction,
        access.businessId,
      );
      const { entries, invoices, otherCurrencies } = await this.load(
        transaction,
        access.businessId,
        { baseCurrency, asOf, customerId: customer.id },
      );

      // Everything before the period start collapses into one number the customer carried in, so
      // narrowing the date range never silently drops history from the closing balance.
      let openingBalance = 0n;
      const withinPeriod: LedgerEntry[] = [];
      for (const entry of entries) {
        if (periodStart && entry.date < periodStart) {
          openingBalance += entry.debitMinor - entry.creditMinor;
          continue;
        }
        withinPeriod.push(entry);
      }

      let balance = openingBalance;
      let totalInvoiced = 0n;
      let totalPaid = 0n;
      let totalCredited = 0n;

      const items: StatementLineItem[] = withinPeriod.map((entry) => {
        balance += entry.debitMinor - entry.creditMinor;
        totalInvoiced += entry.debitMinor;
        if (entry.type === "PAYMENT") totalPaid += entry.creditMinor;
        if (entry.type === "CREDIT_NOTE") totalCredited += entry.creditMinor;

        return {
          id: entry.id,
          date: entry.date,
          type: entry.type,
          referenceNumber: entry.referenceNumber,
          description: entry.description,
          dueDate: entry.dueDate,
          debitMinor: entry.debitMinor.toString(),
          creditMinor: entry.creditMinor.toString(),
          balanceMinor: balance.toString(),
          currency: baseCurrency,
          currencyScale,
        };
      });

      return {
        customerId: customer.publicId,
        customerName: customer.name,
        currency: baseCurrency,
        currencyScale,
        periodStart,
        periodEnd,
        openingBalanceMinor: openingBalance.toString(),
        totalInvoicedMinor: totalInvoiced.toString(),
        totalPaidMinor: totalPaid.toString(),
        totalCreditedMinor: totalCredited.toString(),
        closingBalanceMinor: balance.toString(),
        asOf,
        buckets: ageInvoices(invoices.map(toAgeable), asOf),
        items,
        otherCurrencies,
      };
    });
  }

  /**
   * Loads issued invoices, what has been applied against them, and the two as one ledger.
   *
   * Reading allocations rather than payments is what keeps one customer's statement from crediting
   * another customer's money, and it credits only the portion actually applied here when a payment
   * spans several invoices. A REVERSED or DRAFT payment settles nothing, and a DRAFT credit note
   * has not been issued.
   */
  private async load(
    transaction: TransactionLike,
    businessId: bigint,
    scope: { baseCurrency: string; asOf: string; customerId?: bigint },
  ): Promise<LoadedLedger> {
    const customerFilter = scope.customerId === undefined ? {} : { customerId: scope.customerId };

    const invoiceRows = (await transaction.document.findMany({
      where: {
        businessId,
        type: "INVOICE" as never,
        status: ISSUED_STATUSES as never,
        ...customerFilter,
      },
      include: { customer: { select: { publicId: true, name: true } } },
      orderBy: { issueDate: "asc" },
    })) as unknown as InvoiceRow[];

    const otherCurrencies = [
      ...new Set(
        invoiceRows
          .map((invoice) => invoice.currencyCode)
          .filter((currency) => currency !== scope.baseCurrency),
      ),
    ].sort();

    // bizOS has no exchange rate source, so a document in another currency is excluded from the
    // totals and named in `otherCurrencies` rather than summed at an implied 1:1 rate (ADR-0024).
    const retained = invoiceRows.filter(
      (invoice) =>
        invoice.currencyCode === scope.baseCurrency && toDateOnly(invoice.issueDate) <= scope.asOf,
    );
    const retainedIds = new Set(retained.map((invoice) => invoice.publicId));

    const [paymentAllocations, creditNoteAllocations] = await Promise.all([
      transaction.paymentAllocation.findMany({
        where: {
          businessId,
          document: {
            type: "INVOICE" as never,
            status: ISSUED_STATUSES as never,
            ...customerFilter,
          },
          payment: { status: "COMPLETED" as never },
        },
        include: {
          payment: { select: { publicId: true, paymentDate: true, reference: true } },
          document: { select: { publicId: true } },
        },
      }) as unknown as Promise<PaymentAllocationRow[]>,
      transaction.creditNoteAllocation.findMany({
        where: {
          businessId,
          creditNote: { status: ISSUED_STATUSES as never },
          invoice: {
            type: "INVOICE" as never,
            status: ISSUED_STATUSES as never,
            ...customerFilter,
          },
        },
        include: {
          creditNote: { select: { publicId: true, number: true, issueDate: true } },
          invoice: { select: { publicId: true } },
        },
      }) as unknown as Promise<CreditNoteAllocationRow[]>,
    ]);

    const settledByInvoice = new Map<string, bigint>();
    const entries: LedgerEntry[] = retained.map((invoice) => ({
      id: invoice.publicId,
      date: toDateOnly(invoice.issueDate),
      type: "INVOICE" as const,
      referenceNumber: invoice.number,
      description: `Invoice ${invoice.number}`,
      dueDate: toDateOnly(invoice.dueDate ?? invoice.issueDate),
      debitMinor: BigInt(invoice.totalMinor.toString()),
      creditMinor: 0n,
    }));

    for (const allocation of paymentAllocations) {
      const invoiceId = allocation.document?.publicId;
      const date = toDateOnly(allocation.payment.paymentDate);
      if (!invoiceId || !retainedIds.has(invoiceId) || date > scope.asOf) continue;

      const amountMinor = BigInt(allocation.amountMinor.toString());
      settledByInvoice.set(invoiceId, (settledByInvoice.get(invoiceId) ?? 0n) + amountMinor);
      entries.push({
        id: allocation.publicId,
        date,
        type: "PAYMENT",
        referenceNumber: allocation.payment.reference ?? allocation.payment.publicId,
        description: allocation.payment.reference
          ? `Payment ${allocation.payment.reference}`
          : "Payment",
        dueDate: null,
        debitMinor: 0n,
        creditMinor: amountMinor,
      });
    }

    for (const allocation of creditNoteAllocations) {
      const invoiceId = allocation.invoice.publicId;
      const date = toDateOnly(allocation.creditNote.issueDate);
      if (!retainedIds.has(invoiceId) || date > scope.asOf) continue;

      const amountMinor = BigInt(allocation.amountMinor.toString());
      settledByInvoice.set(invoiceId, (settledByInvoice.get(invoiceId) ?? 0n) + amountMinor);
      entries.push({
        id: allocation.publicId,
        date,
        type: "CREDIT_NOTE",
        referenceNumber: allocation.creditNote.number,
        description: `Credit note ${allocation.creditNote.number}`,
        dueDate: null,
        debitMinor: 0n,
        creditMinor: amountMinor,
      });
    }

    // Invoices, receipts, and credit notes are fetched separately but form one ledger, so they
    // have to be interleaved by date before the running balance means anything.
    entries.sort(
      (left, right) =>
        (left.date < right.date ? -1 : left.date > right.date ? 1 : 0) ||
        TYPE_ORDER[left.type] - TYPE_ORDER[right.type] ||
        left.referenceNumber.localeCompare(right.referenceNumber),
    );

    return {
      invoices: retained.map((invoice) => ({
        publicId: invoice.publicId,
        number: invoice.number,
        issueDate: toDateOnly(invoice.issueDate),
        // A missing due date means "due on issue", never "not yet due" — treating it as not due
        // would hide the oldest debts in the safest bucket.
        payableFrom: toDateOnly(invoice.dueDate ?? invoice.issueDate),
        customerPublicId: invoice.customer?.publicId ?? "",
        customerName: invoice.customer?.name ?? "",
        totalMinor: BigInt(invoice.totalMinor.toString()),
        settledMinor: settledByInvoice.get(invoice.publicId) ?? 0n,
      })),
      entries,
      otherCurrencies,
    };
  }

  private async readBusinessCurrency(
    transaction: TransactionLike,
    businessId: bigint,
  ): Promise<BusinessCurrencyRow> {
    const business = (await transaction.business.findFirst({
      where: { id: businessId },
      select: { baseCurrency: true, currencyScale: true },
    })) as BusinessCurrencyRow | null;

    if (!business) {
      throw new NotFoundException({
        code: "BUSINESS_NOT_FOUND",
        detail: "That business does not exist.",
      });
    }

    return business;
  }

  private async authorize(
    userPublicId: string,
    businessPublicId: string,
    action: AuthorizationAction,
  ): Promise<BusinessAccessContext> {
    const access = await this.businessAccess.resolve(userPublicId, businessPublicId);
    await this.businessAccess.assertAllowed(access, "payments", action);
    return access;
  }
}

/**
 * An invoice reduced to the two facts ageing needs. Outstanding is floored at zero so an
 * overpayment on one invoice never cancels out real debt on another (ADR-0023).
 */
function toAgeable(invoice: SettledInvoice): AgeableInvoice {
  const outstanding = invoice.totalMinor - invoice.settledMinor;
  return {
    dueDate: invoice.payableFrom,
    outstandingMinor: outstanding > 0n ? outstanding : 0n,
  };
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
