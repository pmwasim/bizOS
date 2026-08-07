import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import type { CustomerStatement, StatementLineItem } from "@bizo/contracts/statements";

import { DatabaseService } from "../database/database.service.js";
import { BusinessAccessService } from "../security/business-access.service.js";

@Injectable()
export class StatementsService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(BusinessAccessService) private readonly businessAccess: BusinessAccessService,
  ) {}

  async getCustomerStatement(
    userPublicId: string,
    businessPublicId: string,
    customerPublicId: string,
  ): Promise<CustomerStatement> {
    const access = await this.businessAccess.resolve(userPublicId, businessPublicId);

    return this.database.withScope(access, async (transaction) => {
      const customer = await transaction.customer.findFirst({
        where: { businessId: access.businessId, publicId: customerPublicId, archivedAt: null },
      });

      if (!customer) {
        throw new NotFoundException(`Customer ${customerPublicId} not found.`);
      }

      const invoices = await transaction.document.findMany({
        where: { businessId: access.businessId, customerId: customer.id, type: "INVOICE" },
        orderBy: { createdAt: "asc" },
      });

      const payments = await transaction.payment.findMany({
        where: { businessId: access.businessId },
        orderBy: { paymentDate: "asc" },
      });

      let runningBalance = 0;
      let totalInvoiced = 0;
      let totalPaid = 0;

      type RawEvent = {
        id: string;
        date: Date;
        type: "INVOICE" | "PAYMENT";
        ref: string;
        desc: string;
        debit: number;
        credit: number;
        currency: string;
      };

      const events: RawEvent[] = [];

      for (const inv of invoices) {
        const invTotal = Number(inv.totalMinor);
        events.push({
          id: `inv-${inv.publicId}`,
          date: inv.issuedAt ?? inv.createdAt,
          type: "INVOICE",
          ref: inv.number,
          desc: `Invoice #${inv.number}`,
          debit: invTotal,
          credit: 0,
          currency: inv.currencyCode,
        });
        totalInvoiced += invTotal;
      }

      for (const pay of payments) {
        const payAmount = Number(pay.amountMinor);
        events.push({
          id: `pay-${pay.publicId}`,
          date: pay.paymentDate,
          type: "PAYMENT",
          ref: pay.reference ?? pay.publicId.slice(0, 8),
          desc: `Payment (${pay.type})`,
          debit: 0,
          credit: payAmount,
          currency: pay.currencyCode,
        });
        totalPaid += payAmount;
      }

      events.sort((a, b) => a.date.getTime() - b.date.getTime());

      const items: StatementLineItem[] = events.map((evt) => {
        runningBalance += evt.debit - evt.credit;
        return {
          id: evt.id,
          date: evt.date.toISOString(),
          type: evt.type,
          referenceNumber: evt.ref,
          description: evt.desc,
          debitMinor: evt.debit,
          creditMinor: evt.credit,
          balanceMinor: runningBalance,
          currency: evt.currency,
        };
      });

      return {
        customerId: customer.publicId,
        customerName: customer.name,
        currency: customer.currencyCode,
        openingBalanceMinor: 0,
        totalInvoicedMinor: totalInvoiced,
        totalPaidMinor: totalPaid,
        closingBalanceMinor: runningBalance,
        items,
      };
    });
  }
}
