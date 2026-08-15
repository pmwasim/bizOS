import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import {
  type CreateSalesOrderRequest,
  type SalesOrder,
  type UpdateSalesOrderRequest,
} from "@bizo/contracts/sales-orders";
import { DocumentStatus, DocumentType, type Prisma } from "@bizo/database";

import { DatabaseService } from "../database/database.service";
import {
  type AuthorizationAction,
  type BusinessAccessContext,
  BusinessAccessService,
} from "../security/business-access.service";
import { calculateDocumentTotals } from "../documents/document-calculator.js";

interface DecimalLike {
  toString(): string;
}

interface SalesOrderLineRecord {
  description: string;
  position: number;
  quantity: DecimalLike;
  subtotalMinor: DecimalLike;
  taxMinor: DecimalLike;
  taxRatePpm: number;
  totalMinor: DecimalLike;
  unitPriceMinor: DecimalLike;
}

interface SalesOrderRecord {
  createdAt: Date;
  currencyCode: string;
  currencyScale: number;
  customer: {
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    countryCode: string | null;
    email: string | null;
    name: string;
    phone: string | null;
    postalCode: string | null;
    publicId: string;
  };
  deliveryDate: Date | null;
  id: bigint;
  issueDate: Date;
  lines: SalesOrderLineRecord[];
  notes: string | null;
  number: string;
  publicId: string;
  status: DocumentStatus;
  subtotalMinor: DecimalLike;
  taxMinor: DecimalLike;
  totalMinor: DecimalLike;
  updatedAt: Date;
}

@Injectable()
export class SalesOrdersService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(BusinessAccessService) private readonly businessAccess: BusinessAccessService,
  ) {}

  async create(
    userPublicId: string,
    businessPublicId: string,
    input: CreateSalesOrderRequest,
    requestId: string,
  ): Promise<SalesOrder> {
    const access = await this.authorize(userPublicId, businessPublicId, "create");

    return this.database.withScope(access, async (transaction) => {
      const business = await transaction.business.findUniqueOrThrow({
        where: { id: access.businessId },
        include: { settings: true },
      });
      const settings = business.settings;
      if (!settings) {
        throw new Error("Business settings are incomplete.");
      }

      const customer = await transaction.customer.findFirst({
        where: { businessId: access.businessId, publicId: input.customerId },
      });
      if (!customer) {
        throw new NotFoundException("We could not find that customer.");
      }

      const {
        lines: calculatedLines,
        subtotalMinor,
        taxMinor,
        totalMinor,
      } = calculateDocumentTotals(input.lines, business.currencyScale);

      const updatedSettings = await transaction.businessSettings.update({
        where: { businessId: access.businessId },
        data: { nextSalesOrderNumber: { increment: 1 } },
        select: { nextSalesOrderNumber: true, salesOrderPrefix: true },
      });
      const sequence = updatedSettings.nextSalesOrderNumber - 1;

      const issueDate = input.issueDate ?? this.localDate(business.timeZone);
      const deliveryDate = input.deliveryDate
        ? new Date(`${input.deliveryDate}T00:00:00.000Z`)
        : null;

      const document = (await transaction.document.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          customerId: customer.id,
          type: DocumentType.SALES_ORDER,
          status: DocumentStatus.DRAFT,
          number: `${updatedSettings.salesOrderPrefix}-${String(sequence).padStart(4, "0")}`,
          issueDate: this.toDatabaseDate(issueDate),
          // `documents` is shared with quotations, where valid_until is the offer expiry, so the
          // column is NOT NULL with no default. A sales order is already agreed and does not
          // expire; without a value here every create fails with
          // `null value in column "valid_until" violates not-null constraint`.
          validUntil: deliveryDate ?? this.toDatabaseDate(issueDate),
          deliveryDate,
          currencyCode: business.baseCurrency,
          currencyScale: business.currencyScale,
          subtotalMinor: subtotalMinor.toString(),
          taxMinor: taxMinor.toString(),
          totalMinor: totalMinor.toString(),
          notes: input.notes ?? null,
          createdByMembershipId: access.membershipId,
          lines: {
            create: calculatedLines.map((line) => ({
              position: line.position,
              description: line.description,
              quantity: line.quantity,
              unitPriceMinor: line.unitPriceMinor.toString(),
              taxRatePpm: line.taxRatePpm,
              subtotalMinor: line.subtotalMinor.toString(),
              taxMinor: line.taxMinor.toString(),
              totalMinor: line.totalMinor.toString(),
            })),
          },
        },
        include: this.detailInclude(),
      })) as unknown as SalesOrderRecord;

      await transaction.auditEvent.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          actorUserId: access.userId,
          action: "sales_order.created",
          targetType: "sales_order",
          targetPublicId: document.publicId,
          requestId,
        },
      });

      return this.mapSalesOrder(document);
    });
  }

  async list(userPublicId: string, businessPublicId: string): Promise<SalesOrder[]> {
    const access = await this.authorize(userPublicId, businessPublicId, "read");
    return this.database.withScope(access, async (transaction) => {
      const records = (await transaction.document.findMany({
        where: { businessId: access.businessId, type: DocumentType.SALES_ORDER },
        include: this.detailInclude(),
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 200,
      })) as unknown as SalesOrderRecord[];
      return records.map((record) => this.mapSalesOrder(record));
    });
  }

  async get(
    userPublicId: string,
    businessPublicId: string,
    salesOrderPublicId: string,
  ): Promise<SalesOrder> {
    const access = await this.authorize(userPublicId, businessPublicId, "read");
    return this.database.withScope(access, async (transaction) => {
      const record = await this.findRecord(transaction, access, salesOrderPublicId);
      return this.mapSalesOrder(record);
    });
  }

  async update(
    userPublicId: string,
    businessPublicId: string,
    salesOrderPublicId: string,
    input: UpdateSalesOrderRequest,
    requestId: string,
  ): Promise<SalesOrder> {
    const access = await this.authorize(userPublicId, businessPublicId, "update");
    return this.database.withScope(access, async (transaction) => {
      const existing = await this.findRecord(transaction, access, salesOrderPublicId);
      if (existing.status !== DocumentStatus.DRAFT) {
        throw new BadRequestException("Only draft sales orders can be edited.");
      }

      const {
        lines: calculatedLines,
        subtotalMinor,
        taxMinor,
        totalMinor,
      } = calculateDocumentTotals(input.lines, existing.currencyScale);

      const deliveryDate =
        input.deliveryDate !== undefined
          ? input.deliveryDate
            ? new Date(`${input.deliveryDate}T00:00:00.000Z`)
            : null
          : existing.deliveryDate;

      await transaction.documentLine.deleteMany({
        where: { businessId: access.businessId, documentId: existing.id },
      });

      const updated = (await transaction.document.update({
        where: { id: existing.id },
        data: {
          deliveryDate,
          notes: Object.hasOwn(input, "notes") ? input.notes : existing.notes,
          subtotalMinor: subtotalMinor.toString(),
          taxMinor: taxMinor.toString(),
          totalMinor: totalMinor.toString(),
          lines: {
            create: calculatedLines.map((line) => ({
              position: line.position,
              description: line.description,
              quantity: line.quantity,
              unitPriceMinor: line.unitPriceMinor.toString(),
              taxRatePpm: line.taxRatePpm,
              subtotalMinor: line.subtotalMinor.toString(),
              taxMinor: line.taxMinor.toString(),
              totalMinor: line.totalMinor.toString(),
            })),
          },
        },
        include: this.detailInclude(),
      })) as unknown as SalesOrderRecord;

      await transaction.auditEvent.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          actorUserId: access.userId,
          action: "sales_order.updated",
          targetType: "sales_order",
          targetPublicId: updated.publicId,
          requestId,
        },
      });

      return this.mapSalesOrder(updated);
    });
  }

  async confirm(
    userPublicId: string,
    businessPublicId: string,
    salesOrderPublicId: string,
    requestId: string,
  ): Promise<SalesOrder> {
    const access = await this.authorize(userPublicId, businessPublicId, "update");
    return this.database.withScope(access, async (transaction) => {
      const existing = await this.findRecord(transaction, access, salesOrderPublicId);
      if (existing.status !== DocumentStatus.DRAFT) {
        throw new BadRequestException("Only draft sales orders can be confirmed.");
      }

      const updated = (await transaction.document.update({
        where: { id: existing.id },
        data: { status: DocumentStatus.SENT },
        include: this.detailInclude(),
      })) as unknown as SalesOrderRecord;

      await transaction.auditEvent.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          actorUserId: access.userId,
          action: "sales_order.confirmed",
          targetType: "sales_order",
          targetPublicId: updated.publicId,
          requestId,
        },
      });

      return this.mapSalesOrder(updated);
    });
  }

  async cancel(
    userPublicId: string,
    businessPublicId: string,
    salesOrderPublicId: string,
    requestId: string,
  ): Promise<SalesOrder> {
    const access = await this.authorize(userPublicId, businessPublicId, "update");
    return this.database.withScope(access, async (transaction) => {
      const existing = await this.findRecord(transaction, access, salesOrderPublicId);
      if (existing.status === DocumentStatus.ARCHIVED) {
        throw new BadRequestException("This sales order is already cancelled.");
      }

      const updated = (await transaction.document.update({
        where: { id: existing.id },
        // `documents_archive_consistency_check` requires archived_at and status to move together:
        // ARCHIVED with a null archived_at is rejected outright, so setting the status alone made
        // every cancellation fail. `InvoicesService.archive` already sets both.
        data: { status: DocumentStatus.ARCHIVED, archivedAt: new Date() },
        include: this.detailInclude(),
      })) as unknown as SalesOrderRecord;

      await transaction.auditEvent.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          actorUserId: access.userId,
          action: "sales_order.cancelled",
          targetType: "sales_order",
          targetPublicId: updated.publicId,
          requestId,
        },
      });

      return this.mapSalesOrder(updated);
    });
  }

  private async authorize(
    userPublicId: string,
    businessPublicId: string,
    action: AuthorizationAction,
  ): Promise<BusinessAccessContext> {
    const access = await this.businessAccess.resolve(userPublicId, businessPublicId);
    await this.businessAccess.assertAllowed(access, "sales_orders", action);
    return access;
  }

  private detailInclude() {
    return {
      customer: true,
      lines: { orderBy: { position: "asc" as const } },
    } satisfies Prisma.DocumentInclude;
  }

  private async findRecord(
    transaction: Prisma.TransactionClient,
    access: BusinessAccessContext,
    salesOrderPublicId: string,
  ): Promise<SalesOrderRecord> {
    const record = (await transaction.document.findFirst({
      where: {
        businessId: access.businessId,
        publicId: salesOrderPublicId,
        type: DocumentType.SALES_ORDER,
      },
      include: this.detailInclude(),
    })) as unknown as SalesOrderRecord | null;
    if (!record) {
      throw new NotFoundException("We could not find that sales order.");
    }
    return record;
  }

  private mapSalesOrder(record: SalesOrderRecord): SalesOrder {
    return {
      id: record.publicId,
      number: record.number,
      status: this.mapStatus(record.status),
      issueDate: this.dateOnly(record.issueDate),
      deliveryDate: record.deliveryDate ? this.dateOnly(record.deliveryDate) : null,
      currencyCode: record.currencyCode,
      currencyScale: record.currencyScale,
      subtotalMinor: record.subtotalMinor.toString(),
      taxMinor: record.taxMinor.toString(),
      totalMinor: record.totalMinor.toString(),
      notes: record.notes,
      customer: {
        id: record.customer.publicId,
        name: record.customer.name,
        email: record.customer.email,
        phone: record.customer.phone,
        addressLine1: record.customer.addressLine1,
        addressLine2: record.customer.addressLine2,
        city: record.customer.city,
        postalCode: record.customer.postalCode,
        countryCode: record.customer.countryCode,
      },
      lines: record.lines.map((line) => ({
        position: line.position,
        description: line.description,
        quantity: line.quantity.toString(),
        unitPriceMinor: line.unitPriceMinor.toString(),
        taxRatePpm: line.taxRatePpm,
        subtotalMinor: line.subtotalMinor.toString(),
        taxMinor: line.taxMinor.toString(),
        totalMinor: line.totalMinor.toString(),
      })),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private mapStatus(status: DocumentStatus): SalesOrder["status"] {
    switch (status) {
      case DocumentStatus.DRAFT:
        return "DRAFT";
      case DocumentStatus.SENT:
        return "CONFIRMED";
      case DocumentStatus.ARCHIVED:
        return "CANCELLED";
      default:
        return "FULFILLED";
    }
  }

  private localDate(timeZone: string): string {
    const parts = new Intl.DateTimeFormat("en", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const read = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value;
    return `${read("year")}-${read("month")}-${read("day")}`;
  }

  private toDatabaseDate(value: string): Date {
    return new Date(`${value}T00:00:00.000Z`);
  }

  private dateOnly(value: Date): string {
    return value.toISOString().slice(0, 10);
  }
}
