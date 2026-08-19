import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import {
  type InvoicePaymentSummary,
  type Payment,
  type RecordPaymentRequest,
} from "@bizo/contracts/payments";
import { DocumentType, PaymentStatus, type Prisma, type PaymentType } from "@bizo/database";

import { DatabaseService } from "../database/database.service.js";
import {
  type AuthorizationAction,
  type AuthorizationObject,
  type BusinessAccessContext,
  BusinessAccessService,
} from "../security/business-access.service.js";

type PaymentDetail = {
  id: bigint;
  publicId: string;
  type: PaymentType;
  status: PaymentStatus;
  paymentDate: Date;
  amountMinor: Prisma.Decimal;
  currencyCode: string;
  currencyScale: number;
  reference: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  allocations: Array<{
    publicId: string;
    amountMinor: Prisma.Decimal;
    createdAt: Date;
    document: { publicId: string } | null;
    purchaseOrder: { publicId: string } | null;
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
    input: RecordPaymentRequest,
    requestId: string,
  ): Promise<Payment> {
    this.assertAllocationTotal(input);
    const access = await this.authorize(userPublicId, businessPublicId, "payments", "create");
    return this.database.withScope(access, async (transaction) => {
      const currencyScale = await this.requireBusinessCurrencyScale(
        transaction,
        access,
        input.currencyCode,
      );
      const resolvedAllocations = await Promise.all(
        input.allocations.map(async (allocation) => {
          const targetCount =
            Number(Boolean(allocation.documentId)) + Number(Boolean(allocation.purchaseOrderId));
          if (targetCount !== 1) {
            throw new BadRequestException(
              "Each allocation must reference exactly one invoice or purchase order.",
            );
          }

          let documentId: bigint | null = null;
          let purchaseOrderId: bigint | null = null;

          if (allocation.documentId) {
            const document = await transaction.document.findFirst({
              where: { businessId: access.businessId, publicId: allocation.documentId },
            });
            if (!document) {
              throw new NotFoundException(`Invoice with ID ${allocation.documentId} not found.`);
            }
            documentId = document.id;
          }

          if (allocation.purchaseOrderId) {
            const purchaseOrder = await transaction.purchaseOrder.findFirst({
              where: { businessId: access.businessId, publicId: allocation.purchaseOrderId },
            });
            if (!purchaseOrder) {
              throw new NotFoundException(
                `Purchase Order with ID ${allocation.purchaseOrderId} not found.`,
              );
            }
            purchaseOrderId = purchaseOrder.id;
          }

          return {
            documentId,
            purchaseOrderId,
            amountMinor: allocation.amountMinor,
          };
        }),
      );

      const created = await transaction.payment.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          createdByMembershipId: access.membershipId,
          type: input.type,
          status: PaymentStatus.DRAFT,
          paymentDate: new Date(`${input.paymentDate}T00:00:00.000Z`),
          amountMinor: input.amountMinor,
          currencyCode: input.currencyCode,
          currencyScale,
          reference: input.reference,
          notes: input.notes,
          allocations: {
            create: resolvedAllocations.map((allocation) => ({
              tenantId: access.tenantId,
              businessId: access.businessId,
              documentId: allocation.documentId,
              purchaseOrderId: allocation.purchaseOrderId,
              amountMinor: allocation.amountMinor,
            })),
          },
        },
        include: this.detailInclude(),
      });

      await transaction.auditEvent.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          actorUserId: access.userId,
          action: "payment.created",
          targetType: "payment",
          targetPublicId: created.publicId,
          after: {
            amountMinor: input.amountMinor,
            type: input.type,
          },
          requestId,
        },
      });

      return this.mapPayment(created);
    });
  }

  async list(userPublicId: string, businessPublicId: string): Promise<Payment[]> {
    const access = await this.authorize(userPublicId, businessPublicId, "payments", "read");
    return this.database.withScope(access, async (transaction) => {
      const rows = (await transaction.payment.findMany({
        where: { businessId: access.businessId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 200,
        include: this.detailInclude(),
      })) as PaymentDetail[];
      return rows.map((row) => this.mapPayment(row));
    });
  }

  async get(
    userPublicId: string,
    businessPublicId: string,
    paymentPublicId: string,
  ): Promise<Payment> {
    const access = await this.authorize(userPublicId, businessPublicId, "payments", "read");
    return this.database.withScope(access, async (transaction) => {
      const row = await this.requirePayment(transaction, access, paymentPublicId);
      return this.mapPayment(row);
    });
  }

  async update(
    userPublicId: string,
    businessPublicId: string,
    paymentPublicId: string,
    input: RecordPaymentRequest,
    requestId: string,
  ): Promise<Payment> {
    this.assertAllocationTotal(input);
    const access = await this.authorize(userPublicId, businessPublicId, "payments", "update");
    return this.database.withScope(access, async (transaction) => {
      const existing = await this.requirePayment(transaction, access, paymentPublicId);
      if (existing.status !== PaymentStatus.DRAFT) {
        throw new BadRequestException("Only DRAFT payments can be edited.");
      }

      const currencyScale = await this.requireBusinessCurrencyScale(
        transaction,
        access,
        input.currencyCode,
      );
      const resolvedAllocations = await Promise.all(
        input.allocations.map(async (allocation) => {
          const targetCount =
            Number(Boolean(allocation.documentId)) + Number(Boolean(allocation.purchaseOrderId));
          if (targetCount !== 1) {
            throw new BadRequestException(
              "Each allocation must reference exactly one invoice or purchase order.",
            );
          }

          let documentId: bigint | null = null;
          let purchaseOrderId: bigint | null = null;

          if (allocation.documentId) {
            const document = await transaction.document.findFirst({
              where: { businessId: access.businessId, publicId: allocation.documentId },
            });
            if (!document) {
              throw new NotFoundException(`Invoice with ID ${allocation.documentId} not found.`);
            }
            documentId = document.id;
          }

          if (allocation.purchaseOrderId) {
            const purchaseOrder = await transaction.purchaseOrder.findFirst({
              where: { businessId: access.businessId, publicId: allocation.purchaseOrderId },
            });
            if (!purchaseOrder) {
              throw new NotFoundException(
                `Purchase Order with ID ${allocation.purchaseOrderId} not found.`,
              );
            }
            purchaseOrderId = purchaseOrder.id;
          }

          return {
            documentId,
            purchaseOrderId,
            amountMinor: allocation.amountMinor,
          };
        }),
      );

      await transaction.paymentAllocation.deleteMany({
        where: { paymentId: existing.id },
      });

      const updated = await transaction.payment.update({
        where: { id: existing.id },
        data: {
          type: input.type,
          paymentDate: new Date(`${input.paymentDate}T00:00:00.000Z`),
          amountMinor: input.amountMinor,
          currencyCode: input.currencyCode,
          currencyScale,
          reference: input.reference,
          notes: input.notes,
          allocations: {
            create: resolvedAllocations.map((allocation) => ({
              tenantId: access.tenantId,
              businessId: access.businessId,
              documentId: allocation.documentId,
              purchaseOrderId: allocation.purchaseOrderId,
              amountMinor: allocation.amountMinor,
            })),
          },
        },
        include: this.detailInclude(),
      });

      await transaction.auditEvent.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          actorUserId: access.userId,
          action: "payment.updated",
          targetType: "payment",
          targetPublicId: updated.publicId,
          after: {
            amountMinor: input.amountMinor,
            type: input.type,
          },
          requestId,
        },
      });

      return this.mapPayment(updated);
    });
  }

  async markAsCompleted(
    userPublicId: string,
    businessPublicId: string,
    paymentPublicId: string,
    requestId: string,
  ): Promise<Payment> {
    const access = await this.authorize(userPublicId, businessPublicId, "payments", "complete");
    return this.database.withScope(access, async (transaction) => {
      const existing = await this.requirePayment(transaction, access, paymentPublicId);
      if (existing.status !== PaymentStatus.DRAFT) {
        throw new BadRequestException("Payment is already completed or reversed.");
      }

      const totalAllocatedMinor = existing.allocations.reduce(
        (total, alloc) => total + BigInt(alloc.amountMinor.toFixed(0)),
        0n,
      );
      const paymentAmountMinor = BigInt(existing.amountMinor.toFixed(0));
      const unallocatedMinor = paymentAmountMinor - totalAllocatedMinor;

      if (unallocatedMinor > 0n) {
        await transaction.auditEvent.create({
          data: {
            tenantId: access.tenantId,
            businessId: access.businessId,
            actorUserId: access.userId,
            action: "customer.overpayment_credited",
            targetType: "customer_credit",
            targetPublicId: existing.publicId,
            after: {
              unallocatedAmountMinor: unallocatedMinor.toString(),
              currencyCode: existing.currencyCode,
            },
            requestId,
          },
        });
      }

      // Enforce remaining balance limits for each allocation target (invoices and purchase orders)
      for (const allocation of existing.allocations) {
        if (allocation.document) {
          const document = await transaction.document.findFirst({
            where: {
              businessId: access.businessId,
              publicId: allocation.document.publicId,
            },
            select: { id: true, number: true, totalMinor: true },
          });
          if (document) {
            const priorAllocations = (await transaction.paymentAllocation.findMany({
              where: {
                businessId: access.businessId,
                documentId: document.id,
                paymentId: { not: existing.id },
                payment: { status: PaymentStatus.COMPLETED },
              },
              select: { amountMinor: true },
            })) as Array<{ amountMinor: Prisma.Decimal }>;
            const priorPaidMinor = priorAllocations.reduce(
              (total, alloc) => total + BigInt(alloc.amountMinor.toFixed(0)),
              0n,
            );
            const docTotalMinor = BigInt(document.totalMinor.toFixed(0));
            const newAllocMinor = BigInt(allocation.amountMinor.toFixed(0));
            if (priorPaidMinor + newAllocMinor > docTotalMinor) {
              const remainingMinor =
                docTotalMinor > priorPaidMinor ? docTotalMinor - priorPaidMinor : 0n;
              throw new BadRequestException(
                `Payment allocation of ${newAllocMinor} exceeds remaining balance of ${remainingMinor} on invoice ${document.number}.`,
              );
            }
          }
        }

        if (allocation.purchaseOrder) {
          const purchaseOrder = await transaction.purchaseOrder.findFirst({
            where: {
              businessId: access.businessId,
              publicId: allocation.purchaseOrder.publicId,
            },
            select: { id: true, poNumber: true, amountMinor: true },
          });
          if (purchaseOrder && purchaseOrder.amountMinor) {
            const priorAllocations = (await transaction.paymentAllocation.findMany({
              where: {
                businessId: access.businessId,
                purchaseOrderId: purchaseOrder.id,
                paymentId: { not: existing.id },
                payment: { status: PaymentStatus.COMPLETED },
              },
              select: { amountMinor: true },
            })) as Array<{ amountMinor: Prisma.Decimal }>;
            const priorPaidMinor = priorAllocations.reduce(
              (total, alloc) => total + BigInt(alloc.amountMinor.toFixed(0)),
              0n,
            );
            const poTotalMinor = BigInt(purchaseOrder.amountMinor.toFixed(0));
            const newAllocMinor = BigInt(allocation.amountMinor.toFixed(0));
            if (priorPaidMinor + newAllocMinor > poTotalMinor) {
              const remainingMinor =
                poTotalMinor > priorPaidMinor ? poTotalMinor - priorPaidMinor : 0n;
              throw new BadRequestException(
                `Payment allocation of ${newAllocMinor} exceeds remaining balance of ${remainingMinor} on purchase order ${purchaseOrder.poNumber}.`,
              );
            }
          }
        }
      }

      // No invoice denormalisation here on purpose. This used to write status "PAID"/"PARTIAL" and
      // an `amountPaidMinor` column, neither of which exists — `DocumentStatus` has no such members
      // and the Document table has no such field — so every write threw and was swallowed by a bare
      // catch. The payment was then marked completed while its invoice was untouched, and nothing
      // surfaced. Settlement is derived from `payment_allocations` instead; see
      // `invoicePaymentSummary` below and docs/decisions/0023-invoice-settlement-is-derived.md.
      const updated = await transaction.payment.update({
        where: { id: existing.id },
        data: {
          status: PaymentStatus.COMPLETED,
        },
        include: this.detailInclude(),
      });

      await transaction.auditEvent.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          actorUserId: access.userId,
          action: "payment.completed",
          targetType: "payment",
          targetPublicId: updated.publicId,
          after: { status: PaymentStatus.COMPLETED },
          requestId,
        },
      });

      return this.mapPayment(updated);
    });
  }

  async reverse(
    userPublicId: string,
    businessPublicId: string,
    paymentPublicId: string,
    requestId: string,
  ): Promise<Payment> {
    const access = await this.authorize(userPublicId, businessPublicId, "payments", "reverse");
    return this.database.withScope(access, async (transaction) => {
      const existing = await this.requirePayment(transaction, access, paymentPublicId);
      if (existing.status !== PaymentStatus.COMPLETED) {
        throw new BadRequestException("Only completed payments can be reversed.");
      }

      // Reversal is symmetric with completion: nothing to unwind on the invoice, because nothing
      // was written to it. Excluding this payment from the derived summary is what un-settles the
      // invoice, and `invoicePaymentSummary` already counts only COMPLETED payments.
      const totalAllocatedMinor = existing.allocations.reduce(
        (total, alloc) => total + BigInt(alloc.amountMinor.toFixed(0)),
        0n,
      );
      const paymentAmountMinor = BigInt(existing.amountMinor.toFixed(0));
      const unallocatedMinor = paymentAmountMinor - totalAllocatedMinor;

      if (unallocatedMinor > 0n) {
        await transaction.auditEvent.create({
          data: {
            tenantId: access.tenantId,
            businessId: access.businessId,
            actorUserId: access.userId,
            action: "customer.overpayment_debited",
            targetType: "customer_credit",
            targetPublicId: existing.publicId,
            after: {
              reversedAmountMinor: unallocatedMinor.toString(),
              currencyCode: existing.currencyCode,
            },
            requestId,
          },
        });
      }

      const updated = await transaction.payment.update({
        where: { id: existing.id },
        data: {
          status: PaymentStatus.REVERSED,
        },
        include: this.detailInclude(),
      });

      await transaction.auditEvent.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          actorUserId: access.userId,
          action: "payment.reversed",
          targetType: "payment",
          targetPublicId: updated.publicId,
          after: { status: PaymentStatus.REVERSED },
          requestId,
        },
      });

      return this.mapPayment(updated);
    });
  }

  private assertAllocationTotal(input: RecordPaymentRequest): void {
    const allocatedMinor = input.allocations.reduce(
      (total, allocation) => total + BigInt(allocation.amountMinor),
      0n,
    );
    if (allocatedMinor > BigInt(input.amountMinor)) {
      throw new BadRequestException("Payment allocations cannot exceed the payment amount.");
    }
  }

  /**
   * How much of one invoice has actually been settled.
   *
   * Derived from allocations rather than read off the document: `payment_allocations` is the only
   * place settlement is recorded, and deriving keeps a reversal correct for free — a REVERSED
   * payment simply stops counting, with no compensating write to get wrong.
   */
  async invoicePaymentSummary(
    userPublicId: string,
    businessPublicId: string,
    invoicePublicId: string,
  ): Promise<InvoicePaymentSummary> {
    const access = await this.authorize(userPublicId, businessPublicId, "payments", "read");

    return this.database.withScope(access, async (transaction) => {
      const invoice = await transaction.document.findFirst({
        where: {
          businessId: access.businessId,
          publicId: invoicePublicId,
          type: DocumentType.INVOICE,
        },
        select: {
          id: true,
          publicId: true,
          number: true,
          totalMinor: true,
          currencyCode: true,
          currencyScale: true,
        },
      });

      if (!invoice) {
        throw new NotFoundException({
          code: "INVOICE_NOT_FOUND",
          detail: "That invoice does not exist in this business.",
        });
      }

      const allocations = await transaction.paymentAllocation.findMany({
        where: {
          businessId: access.businessId,
          documentId: invoice.id,
          payment: { status: PaymentStatus.COMPLETED },
        },
        select: { amountMinor: true },
      });

      const totalMinor = BigInt(invoice.totalMinor.toFixed(0));
      const paidMinor = (allocations as Array<{ amountMinor: Prisma.Decimal }>).reduce(
        (running: bigint, allocation) => running + BigInt(allocation.amountMinor.toFixed(0)),
        0n,
      );
      // An overpayment leaves nothing outstanding rather than a negative balance; the surplus is
      // already audited as a customer credit when the payment completes.
      const outstandingMinor = totalMinor > paidMinor ? totalMinor - paidMinor : 0n;

      return {
        id: invoice.publicId,
        number: invoice.number,
        totalMinor: totalMinor.toString(),
        paidMinor: paidMinor.toString(),
        outstandingMinor: outstandingMinor.toString(),
        currencyCode: invoice.currencyCode,
        currencyScale: invoice.currencyScale,
      };
    });
  }

  private async authorize(
    userPublicId: string,
    businessPublicId: string,
    object: AuthorizationObject,
    action: AuthorizationAction,
  ): Promise<BusinessAccessContext> {
    const access = await this.businessAccess.resolve(userPublicId, businessPublicId);
    await this.businessAccess.assertAllowed(access, object, action);
    return access;
  }

  private async requireBusinessCurrencyScale(
    transaction: Prisma.TransactionClient,
    access: BusinessAccessContext,
    currencyCode: string,
  ): Promise<number> {
    const businessModel = transaction.business ?? this.database.client.business;
    const business = await businessModel.findFirst({
      where: { id: access.businessId },
      select: { baseCurrency: true, currencyScale: true },
    });
    if (!business) {
      throw new NotFoundException("We could not find that business.");
    }
    if (business.baseCurrency !== currencyCode) {
      throw new BadRequestException(
        `Payment currency must match the business base currency (${business.baseCurrency}).`,
      );
    }
    return business.currencyScale;
  }

  private detailInclude() {
    return {
      allocations: {
        include: {
          document: { select: { publicId: true } },
          purchaseOrder: { select: { publicId: true } },
        },
      },
    };
  }

  private async requirePayment(
    transaction: Prisma.TransactionClient,
    access: BusinessAccessContext,
    paymentPublicId: string,
  ) {
    const row = await transaction.payment.findFirst({
      where: { businessId: access.businessId, publicId: paymentPublicId },
      include: this.detailInclude(),
    });
    if (!row) {
      throw new NotFoundException("We could not find that payment.");
    }
    return row as PaymentDetail;
  }

  private mapPayment(row: PaymentDetail): Payment {
    return {
      id: row.publicId,
      type: row.type,
      status: row.status,
      paymentDate: row.paymentDate.toISOString().slice(0, 10),
      amountMinor: row.amountMinor.toFixed(0),
      currencyCode: row.currencyCode,
      currencyScale: row.currencyScale,
      reference: row.reference,
      notes: row.notes,
      allocations: row.allocations.map((allocation) => ({
        id: allocation.publicId,
        amountMinor: allocation.amountMinor.toFixed(0),
        documentId: allocation.document?.publicId ?? null,
        purchaseOrderId: allocation.purchaseOrder?.publicId ?? null,
        createdAt: allocation.createdAt.toISOString(),
      })),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
