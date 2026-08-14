import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import { type CustomerStatement, type StatementLineItem } from "@bizo/contracts/statements";

import { DatabaseService } from "../database/database.service";
import {
  type AuthorizationAction,
  type BusinessAccessContext,
  BusinessAccessService,
} from "../security/business-access.service";

/**
 * Minimal row shapes for the two ledger sources. The `where` clauses cast enum values through
 * `never`, which collapses Prisma's inference on the result, so the fields used here are named
 * explicitly rather than left implicitly `any`.
 */
interface InvoiceRow {
  publicId: string;
  number: string;
  issueDate: Date;
  totalMinor: { toString(): string };
}

interface CustomerPaymentRow {
  publicId: string;
  number: string;
  receivedOn: Date;
  amountMinor: { toString(): string };
  reference: string | null;
}

/** A ledger entry before the running balance is applied. */
interface PendingLine {
  id: string;
  date: string;
  type: StatementLineItem["type"];
  referenceNumber: string;
  description: string;
  debitMinor: bigint;
  creditMinor: bigint;
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
      if (!customer) {
        throw new NotFoundException({
          code: "CUSTOMER_NOT_FOUND",
          detail: "That customer does not exist in this business.",
        });
      }

      const invoices = await transaction.document.findMany({
        where: {
          businessId: access.businessId,
          customerId: customer.id,
          type: "INVOICE" as never,
        },
        orderBy: { issueDate: "asc" },
      });

      // Payments live on CustomerPayment, which is the model that actually carries customerId.
      // Scoping by customer here is what keeps one customer's statement from showing another's
      // payments, and VOIDED rows are excluded because a voided receipt never settled anything.
      const payments = await transaction.customerPayment.findMany({
        where: {
          businessId: access.businessId,
          customerId: customer.id,
          status: "RECORDED" as never,
        },
        orderBy: { receivedOn: "asc" },
      });

      const pending: PendingLine[] = [
        ...(invoices as InvoiceRow[]).map((invoice) => ({
          id: invoice.publicId,
          date: invoice.issueDate.toISOString().slice(0, 10),
          type: "INVOICE" as const,
          referenceNumber: invoice.number,
          description: `Invoice ${invoice.number}`,
          debitMinor: BigInt(invoice.totalMinor.toString()),
          creditMinor: 0n,
        })),
        ...(payments as CustomerPaymentRow[]).map((payment) => ({
          id: payment.publicId,
          date: payment.receivedOn.toISOString().slice(0, 10),
          type: "PAYMENT" as const,
          referenceNumber: payment.number,
          description: payment.reference
            ? `Payment ${payment.number} (${payment.reference})`
            : `Payment ${payment.number}`,
          debitMinor: 0n,
          creditMinor: BigInt(payment.amountMinor.toString()),
        })),
      ];

      // Invoices and payments are fetched separately but form one ledger, so they have to be
      // interleaved by date before the running balance means anything. Ties settle invoice-first,
      // so a payment received the same day it was invoiced does not read as paying a debt that
      // does not exist yet.
      pending.sort((left, right) => {
        if (left.date !== right.date) return left.date < right.date ? -1 : 1;
        if (left.type === right.type) return 0;
        return left.type === "INVOICE" ? -1 : 1;
      });

      const currency = customer.currencyCode ?? "USD";
      let balance = 0n;
      let totalInvoiced = 0n;
      let totalPaid = 0n;

      const items: StatementLineItem[] = pending.map((line) => {
        balance += line.debitMinor - line.creditMinor;
        totalInvoiced += line.debitMinor;
        totalPaid += line.creditMinor;
        return {
          id: line.id,
          date: line.date,
          type: line.type,
          referenceNumber: line.referenceNumber,
          description: line.description,
          debitMinor: Number(line.debitMinor),
          creditMinor: Number(line.creditMinor),
          balanceMinor: Number(balance),
          currency,
        };
      });

      return {
        customerId: customer.publicId,
        customerName: customer.name,
        currency,
        // Every invoice and receipt for the customer is included, so the statement starts at zero
        // rather than carrying a balance forward from an earlier period.
        openingBalanceMinor: 0,
        totalInvoicedMinor: Number(totalInvoiced),
        totalPaidMinor: Number(totalPaid),
        closingBalanceMinor: Number(balance),
        items,
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
