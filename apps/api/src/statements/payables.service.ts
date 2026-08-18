import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import {
  type PayablesQuery,
  type PayablesSummary,
  type PayableSupplier,
} from "@bizo/contracts/statements";

import { DatabaseService } from "../database/database.service.js";
import { BusinessAccessService } from "../security/business-access.service.js";
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
 * The bill statuses that represent money the business currently owes.
 *
 * `createSupplierBill` records every supplier bill as `DocumentStatus.DRAFT`, and bizOS has no
 * supplier-bill approval transition — nothing moves a bill out of DRAFT (unlike supplier POs, which
 * `issueSupplierPo` sends). So the status a recorded, still-owed bill actually carries is DRAFT.
 * Counting only SENT — a status no supplier bill ever reaches — meant every payables summary
 * reported nothing outstanding, however many bills the business had recorded. This mirrors
 * receivables, which counts the status an issued invoice actually carries (`SENT`): the payable is
 * the recorded, unsettled bill. A cancelled bill (`ARCHIVED`) is not owed, and settlement (PAID) is
 * MMF-2. When a bill-approval transition is added, widen this to include the approved status.
 *
 * bizOS records no outbound payment, so a bill is settled all-or-nothing (see MMF-2). There is no
 * partial state to net off, and none is invented here.
 */
const OWED_BILL_STATUSES = { in: ["DRAFT"] } as const;

type TransactionLike = Parameters<Parameters<DatabaseService["withScope"]>[1]>[0];

interface DecimalLike {
  toString(): string;
}

interface BillRow {
  publicId: string;
  issueDate: Date;
  dueDate: Date | null;
  currencyCode: string;
  totalMinor: DecimalLike;
  supplier: { publicId: string; name: string } | null;
}

interface BusinessCurrencyRow {
  baseCurrency: string;
  currencyScale: number;
}

/** What the business owes its suppliers, aged per bill. */
@Injectable()
export class PayablesService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(BusinessAccessService) private readonly businessAccess: BusinessAccessService,
  ) {}

  async payables(
    userPublicId: string,
    businessPublicId: string,
    query: PayablesQuery = {},
  ): Promise<PayablesSummary> {
    const access = await this.businessAccess.resolve(userPublicId, businessPublicId);
    await this.businessAccess.assertAllowed(access, "payments", "read");

    const asOf = query.asOf ?? today();

    return this.database.withScope(access, async (transaction) => {
      const { baseCurrency, currencyScale } = await this.readBusinessCurrency(
        transaction,
        access.businessId,
      );

      const billRows = (await transaction.document.findMany({
        where: {
          businessId: access.businessId,
          type: "SUPPLIER_BILL" as never,
          status: OWED_BILL_STATUSES as never,
        },
        include: { supplier: { select: { publicId: true, name: true } } },
        orderBy: { issueDate: "asc" },
      })) as unknown as BillRow[];

      const otherCurrencies = [
        ...new Set(
          billRows.map((bill) => bill.currencyCode).filter((currency) => currency !== baseCurrency),
        ),
      ].sort();

      // No exchange rate source, so a bill in another currency is named and left out rather than
      // summed at an implied 1:1 rate (ADR-0024).
      const retained = billRows.filter(
        (bill) => bill.currencyCode === baseCurrency && toDateOnly(bill.issueDate) <= asOf,
      );

      const bySupplier = new Map<string, { name: string; ageable: AgeableInvoice[] }>();
      for (const bill of retained) {
        const outstandingMinor = BigInt(bill.totalMinor.toString());
        if (outstandingMinor <= 0n) continue;

        // A missing due date means "payable on receipt", never "not yet due" — the same rule
        // receivables applies, so the oldest debts cannot hide in the safest bucket.
        const ageable: AgeableInvoice = {
          dueDate: toDateOnly(bill.dueDate ?? bill.issueDate),
          outstandingMinor,
        };

        const supplierId = bill.supplier?.publicId ?? "unknown";
        const entry = bySupplier.get(supplierId) ?? {
          name: bill.supplier?.name ?? "Unknown supplier",
          ageable: [],
        };
        entry.ageable.push(ageable);
        bySupplier.set(supplierId, entry);
      }

      const suppliers: PayableSupplier[] = [...bySupplier.entries()]
        .map(([supplierId, entry]) => {
          const buckets = ageInvoices(entry.ageable, asOf);
          const outstandingMinor = entry.ageable.reduce(
            (sum, item) => sum + item.outstandingMinor,
            0n,
          );

          return {
            supplierId,
            supplierName: entry.name,
            outstandingMinor: outstandingMinor.toString(),
            overdueMinor: overdueTotal(buckets),
            openBillCount: entry.ageable.length,
            oldestDueDate: entry.ageable.map((item) => item.dueDate).sort()[0] ?? null,
            buckets,
          };
        })
        // Read to decide who to pay first, so the largest balance leads and ties fall back to the
        // name rather than to whichever row the database happened to return first.
        .sort(
          (left, right) =>
            compareMinorDesc(left.outstandingMinor, right.outstandingMinor) ||
            left.supplierName.localeCompare(right.supplierName),
        );

      const buckets = suppliers.reduce(
        (total, supplier) => addBuckets(total, supplier.buckets),
        emptyAgeingBuckets,
      );

      return {
        asOf,
        currency: baseCurrency,
        currencyScale,
        totalOutstandingMinor: sumMinor(suppliers.map((supplier) => supplier.outstandingMinor)),
        totalOverdueMinor: overdueTotal(buckets),
        buckets,
        suppliers,
        otherCurrencies,
        partialSettlementSupported: false as const,
      };
    });
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
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
