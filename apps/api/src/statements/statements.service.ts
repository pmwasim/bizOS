import { Inject, Injectable } from "@nestjs/common";

import { DatabaseService } from "../database/database.service";
import {
  type AuthorizationAction,
  type BusinessAccessContext,
  BusinessAccessService,
} from "../security/business-access.service";

interface StatementLine {
  date: string;
  description: string;
  debitMinor: string | null;
  creditMinor: string | null;
  balanceMinor: string;
}

interface CustomerStatement {
  customerId: string;
  customerName: string;
  currencyCode: string;
  currencyScale: number;
  openingBalanceMinor: string;
  closingBalanceMinor: string;
  lines: StatementLine[];
}

@Injectable()
export class StatementsService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(BusinessAccessService) private readonly businessAccess: BusinessAccessService,
  ) {}

  async customer(
    userPublicId: string,
    businessPublicId: string,
    customerPublicId: string,
  ): Promise<CustomerStatement> {
    const access = await this.authorize(userPublicId, businessPublicId, "read");

    return this.database.withScope(access, async (transaction) => {
      const customer = await transaction.customer.findFirst({
        where: { businessId: access.businessId, publicId: customerPublicId },
      });
      if (!customer) throw new Error("Customer not found");

      const invoices = await transaction.document.findMany({
        where: { businessId: access.businessId, customerId: customer.id, type: "INVOICE" as never },
        include: { lines: true },
        orderBy: { issueDate: "asc" },
      });

      const payments = await transaction.payment.findMany({
        where: {
          businessId: access.businessId,
          type: "INBOUND" as never,
          status: "COMPLETED" as never,
        },
        orderBy: { paymentDate: "asc" },
      });

      const lines: StatementLine[] = [];
      let balance = 0n;
      const currencyCode = customer.currencyCode ?? "USD";
      const currencyScale = 2;

      for (const invoice of invoices) {
        const totalMinor = BigInt(invoice.totalMinor.toString());
        balance += totalMinor;
        lines.push({
          date: invoice.issueDate.toISOString().slice(0, 10),
          description: `Invoice ${invoice.number}`,
          debitMinor: totalMinor.toString(),
          creditMinor: null,
          balanceMinor: balance.toString(),
        });
      }

      for (const payment of payments) {
        const amountMinor = BigInt(payment.amountMinor.toString());
        balance -= amountMinor;
        lines.push({
          date: payment.paymentDate.toISOString().slice(0, 10),
          description: `Payment ${payment.reference ?? payment.number}`,
          debitMinor: null,
          creditMinor: amountMinor.toString(),
          balanceMinor: balance.toString(),
        });
      }

      return {
        customerId: customer.publicId,
        customerName: customer.name,
        currencyCode,
        currencyScale,
        openingBalanceMinor: "0",
        closingBalanceMinor: balance.toString(),
        lines,
      };
    });
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
