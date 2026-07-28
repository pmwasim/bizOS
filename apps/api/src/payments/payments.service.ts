import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import { parseDecimalToScaledInteger } from "@bizo/contracts/money";
import {
  type CreateCustomerPaymentRequest,
  type CustomerPayment,
  deriveInvoiceBalanceStatus,
  type InvoicePaymentSummary,
  type VoidCustomerPaymentRequest,
} from "@bizo/contracts/payments";
import {
  CustomerPaymentStatus,
  DocumentStatus,
  DocumentType,
  type PaymentMethod,
  type Prisma,
} from "@bizo/database";

import { DatabaseService } from "../database/database.service.js";
import {
  type AuthorizationAction,
  type BusinessAccessContext,
  BusinessAccessService,
} from "../security/business-access.service.js";

type DecimalLike = { toString(): string };

type PaymentRecord = {
  amountMinor: DecimalLike;
  createdAt: Date;
  currencyCode: string;
  currencyScale: number;
  customer: { name: string; publicId: string };
  id: bigint;
  method: PaymentMethod;
  notes: string | null;
  number: string;
  publicId: string;
  receivedOn: Date;
  reference: string | null;
  status: CustomerPaymentStatus;
  updatedAt: Date;
  voidedAt: Date | null;
  voidReason: string | null;
  allocations: Array<{
    amountMinor: DecimalLike;
    createdAt: Date;
    publicId: string;
    invoice: { number: string; publicId: string };
  }>;
};

@Injectable()
export class PaymentsService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(BusinessAccessService) private readonly businessAccess: BusinessAccessService,
  ) {}

  async create(
    userPublicId: string,
    businessPublicId: string,
    input: CreateCustomerPaymentRequest,
    requestId: string,
  ): Promise<CustomerPayment> {
    const access = await this.authorize(userPublicId, businessPublicId, "create");
    return this.database.withScope(access, async (transaction) => {
      const invoice = await transaction.document.findFirst({
        where: {
          businessId: access.businessId,
          publicId: input.invoiceId,
          type: DocumentType.INVOICE,
        },
        include: {
          customer: { select: { id: true, publicId: true, name: true } },
        },
      });
      if (!invoice) {
        throw new NotFoundException("We could not find that invoice.");
      }
      if (invoice.status !== DocumentStatus.SENT) {
        throw new BadRequestException({
          code: "INVOICE_NOT_SENT",
          detail: "Record payments only against sent invoices.",
        });
      }

      const amountMinor = parseDecimalToScaledInteger(input.amount, invoice.currencyScale);
      if (amountMinor <= 0n) {
        throw new BadRequestException({
          code: "INVALID_PAYMENT_AMOUNT",
          detail: "Amount must be greater than zero.",
        });
      }

      const outstanding = await this.outstandingMinor(transaction, access, invoice.id);
      if (amountMinor > outstanding) {
        throw new BadRequestException({
          code: "PAYMENT_EXCEEDS_OUTSTANDING",
          detail: "That amount is more than the invoice still owes.",
        });
      }

      const settings = (await transaction.businessSettings.update({
        where: { businessId: access.businessId },
        data: { nextPaymentNumber: { increment: 1 } },
        select: { paymentPrefix: true, nextPaymentNumber: true },
      })) as { paymentPrefix: string; nextPaymentNumber: number };
      const sequence = settings.nextPaymentNumber - 1;

      const payment = (await transaction.customerPayment.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          customerId: invoice.customerId,
          number: `${settings.paymentPrefix}-${String(sequence).padStart(4, "0")}`,
          status: CustomerPaymentStatus.RECORDED,
          receivedOn: this.toDatabaseDate(input.receivedOn),
          method: input.method,
          reference: input.reference,
          notes: input.notes,
          currencyCode: invoice.currencyCode,
          currencyScale: invoice.currencyScale,
          amountMinor: amountMinor.toString(),
          createdByMembershipId: access.membershipId,
          allocations: {
            create: {
              tenantId: access.tenantId,
              businessId: access.businessId,
              invoiceDocumentId: invoice.id,
              amountMinor: amountMinor.toString(),
            },
          },
        },
        include: this.detailInclude(),
      })) as unknown as PaymentRecord;

      await transaction.auditEvent.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          actorUserId: access.userId,
          action: "payment.recorded",
          targetType: "payment",
          targetPublicId: payment.publicId,
          requestId,
          after: {
            invoiceId: invoice.publicId,
            amountMinor: amountMinor.toString(),
            method: input.method,
          },
        },
      });

      return this.mapPayment(payment);
    });
  }

  async list(userPublicId: string, businessPublicId: string): Promise<CustomerPayment[]> {
    const access = await this.authorize(userPublicId, businessPublicId, "read");
    return this.database.withScope(access, async (transaction) => {
      const rows = (await transaction.customerPayment.findMany({
        where: { businessId: access.businessId },
        include: this.detailInclude(),
        orderBy: [{ receivedOn: "desc" }, { id: "desc" }],
        take: 200,
      })) as unknown as PaymentRecord[];
      return rows.map((row) => this.mapPayment(row));
    });
  }

  async get(
    userPublicId: string,
    businessPublicId: string,
    paymentPublicId: string,
  ): Promise<CustomerPayment> {
    const access = await this.authorize(userPublicId, businessPublicId, "read");
    return this.database.withScope(access, async (transaction) => {
      const row = await this.requirePayment(transaction, access, paymentPublicId);
      return this.mapPayment(row);
    });
  }

  async void(
    userPublicId: string,
    businessPublicId: string,
    paymentPublicId: string,
    input: VoidCustomerPaymentRequest,
    requestId: string,
  ): Promise<CustomerPayment> {
    const access = await this.authorize(userPublicId, businessPublicId, "void");
    return this.database.withScope(access, async (transaction) => {
      const existing = await this.requirePayment(transaction, access, paymentPublicId);
      if (existing.status === CustomerPaymentStatus.VOIDED) {
        return this.mapPayment(existing);
      }

      const updated = (await transaction.customerPayment.update({
        where: { id: existing.id },
        data: {
          status: CustomerPaymentStatus.VOIDED,
          voidedAt: new Date(),
          voidReason: input.reason,
        },
        include: this.detailInclude(),
      })) as unknown as PaymentRecord;

      await transaction.auditEvent.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          actorUserId: access.userId,
          action: "payment.voided",
          targetType: "payment",
          targetPublicId: updated.publicId,
          requestId,
          after: { reason: input.reason },
        },
      });

      return this.mapPayment(updated);
    });
  }

  async summarizeInvoice(
    userPublicId: string,
    businessPublicId: string,
    invoicePublicId: string,
  ): Promise<InvoicePaymentSummary> {
    const access = await this.authorize(userPublicId, businessPublicId, "read");
    return this.database.withScope(access, async (transaction) => {
      const invoice = await transaction.document.findFirst({
        where: {
          businessId: access.businessId,
          publicId: invoicePublicId,
          type: DocumentType.INVOICE,
        },
        select: { id: true, totalMinor: true },
      });
      if (!invoice) {
        throw new NotFoundException("We could not find that invoice.");
      }

      const allocations = await transaction.paymentAllocation.findMany({
        where: {
          businessId: access.businessId,
          invoiceDocumentId: invoice.id,
          payment: { status: CustomerPaymentStatus.RECORDED },
        },
        include: {
          payment: {
            select: {
              publicId: true,
              number: true,
              status: true,
              receivedOn: true,
              method: true,
              amountMinor: true,
            },
          },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      });

      let allocated = 0n;
      const payments = allocations.map((allocation: (typeof allocations)[number]) => {
        const allocationAmount = BigInt(allocation.amountMinor.toString());
        allocated += allocationAmount;
        return {
          id: allocation.payment.publicId,
          number: allocation.payment.number,
          status: allocation.payment.status,
          receivedOn: this.dateOnly(allocation.payment.receivedOn),
          method: allocation.payment.method,
          amountMinor: allocation.payment.amountMinor.toString(),
          allocationAmountMinor: allocationAmount.toString(),
        };
      });

      const totalMinor = invoice.totalMinor.toString();
      const allocatedMinor = allocated.toString();
      const outstanding = BigInt(totalMinor) - allocated;
      return {
        totalMinor,
        allocatedMinor,
        outstandingMinor: (outstanding > 0n ? outstanding : 0n).toString(),
        balanceStatus: deriveInvoiceBalanceStatus({ totalMinor, allocatedMinor }),
        payments,
      };
    });
  }

  private async outstandingMinor(
    transaction: Prisma.TransactionClient,
    access: BusinessAccessContext,
    invoiceId: bigint,
  ): Promise<bigint> {
    const invoice = await transaction.document.findFirstOrThrow({
      where: { businessId: access.businessId, id: invoiceId },
      select: { totalMinor: true },
    });
    const aggregates = await transaction.paymentAllocation.findMany({
      where: {
        businessId: access.businessId,
        invoiceDocumentId: invoiceId,
        payment: { status: CustomerPaymentStatus.RECORDED },
      },
      select: { amountMinor: true },
    });
    let allocated = 0n;
    for (const row of aggregates) {
      allocated += BigInt(row.amountMinor.toString());
    }
    const outstanding = BigInt(invoice.totalMinor.toString()) - allocated;
    return outstanding > 0n ? outstanding : 0n;
  }

  private async requirePayment(
    transaction: Prisma.TransactionClient,
    access: BusinessAccessContext,
    paymentPublicId: string,
  ): Promise<PaymentRecord> {
    const row = (await transaction.customerPayment.findFirst({
      where: { businessId: access.businessId, publicId: paymentPublicId },
      include: this.detailInclude(),
    })) as unknown as PaymentRecord | null;
    if (!row) {
      throw new NotFoundException("We could not find that payment.");
    }
    return row;
  }

  private detailInclude() {
    return {
      customer: { select: { publicId: true, name: true } },
      allocations: {
        include: {
          invoice: { select: { publicId: true, number: true } },
        },
        orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
      },
    };
  }

  private mapPayment(record: PaymentRecord): CustomerPayment {
    return {
      id: record.publicId,
      number: record.number,
      status: record.status,
      receivedOn: this.dateOnly(record.receivedOn),
      method: record.method,
      reference: record.reference,
      notes: record.notes,
      currencyCode: record.currencyCode,
      currencyScale: record.currencyScale,
      amountMinor: record.amountMinor.toString(),
      voidedAt: record.voidedAt ? record.voidedAt.toISOString() : null,
      voidReason: record.voidReason,
      customer: {
        id: record.customer.publicId,
        name: record.customer.name,
      },
      allocations: record.allocations.map((allocation) => ({
        id: allocation.publicId,
        amountMinor: allocation.amountMinor.toString(),
        invoice: {
          id: allocation.invoice.publicId,
          number: allocation.invoice.number,
        },
        createdAt: allocation.createdAt.toISOString(),
      })),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private dateOnly(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private toDatabaseDate(value: string): Date {
    return new Date(`${value}T00:00:00.000Z`);
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
