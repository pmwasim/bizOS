import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import { type CreateDeliveryNoteRequest, type DeliveryNote } from "@bizo/contracts/delivery-notes";
import { DocumentType, type Prisma } from "@bizo/database";

import { DatabaseService } from "../database/database.service";
import {
  type AuthorizationAction,
  type BusinessAccessContext,
  BusinessAccessService,
} from "../security/business-access.service";

interface DecimalLike {
  toString(): string;
}

interface DeliveryNoteLineRecord {
  description: string;
  position: number;
  quantity: DecimalLike;
}

interface DeliveryNoteRecord {
  createdAt: Date;
  customer: {
    email: string | null;
    name: string;
    phone: string | null;
    publicId: string;
  };
  deliveryDate: Date | null;
  id: bigint;
  notes: string | null;
  number: string;
  publicId: string;
  lines: DeliveryNoteLineRecord[];
  receivedAt: Date | null;
  sourceDocument: { number: string; publicId: string } | null;
  status: DocumentType;
  updatedAt: Date;
}

@Injectable()
export class DeliveryNotesService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(BusinessAccessService) private readonly businessAccess: BusinessAccessService,
  ) {}

  async create(
    userPublicId: string,
    businessPublicId: string,
    input: CreateDeliveryNoteRequest,
    requestId: string,
  ): Promise<DeliveryNote> {
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

      let sourceDocumentId: bigint | null = null;
      if (input.salesOrderId) {
        const so = await transaction.document.findFirst({
          where: {
            businessId: access.businessId,
            publicId: input.salesOrderId,
            type: DocumentType.SALES_ORDER,
          },
        });
        if (!so) {
          throw new NotFoundException("We could not find that sales order.");
        }
        sourceDocumentId = so.id;
      }

      const updatedSettings = await transaction.businessSettings.update({
        where: { businessId: access.businessId },
        data: { nextDeliveryNoteNumber: { increment: 1 } },
        select: { nextDeliveryNoteNumber: true, deliveryNotePrefix: true },
      });
      const sequence = updatedSettings.nextDeliveryNoteNumber - 1;

      const deliveryDate = input.deliveryDate
        ? new Date(`${input.deliveryDate}T00:00:00.000Z`)
        : null;

      const issueDate = new Date();

      const document = (await transaction.document.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          customerId: customer.id,
          type: DocumentType.DELIVERY_NOTE,
          number: `${updatedSettings.deliveryNotePrefix}-${String(sequence).padStart(4, "0")}`,
          issueDate,
          // `documents` is shared with quotations, so valid_until and the money columns are NOT
          // NULL with no default. A delivery note has no expiry and carries no amount, but the
          // row still has to satisfy the table: without these six values every create fails with
          // `null value in column "valid_until" violates not-null constraint`.
          // The issue date, not the delivery date: `documents_dates_check` requires
          // `valid_until >= issue_date`, and a backdated delivery date is a legitimate input the
          // request schema accepts.
          validUntil: issueDate,
          currencyCode: business.baseCurrency,
          currencyScale: business.currencyScale,
          subtotalMinor: "0",
          taxMinor: "0",
          totalMinor: "0",
          deliveryDate,
          sourceDocumentId,
          notes: input.notes ?? null,
          createdByMembershipId: access.membershipId,
          lines: {
            create: input.lines.map((line) => ({
              position: 1,
              description: line.description,
              quantity: line.quantity,
              unitPriceMinor: "0",
              taxRatePpm: 0,
              subtotalMinor: "0",
              taxMinor: "0",
              totalMinor: "0",
            })),
          },
        },
        include: this.detailInclude(),
      })) as unknown as DeliveryNoteRecord;

      await transaction.auditEvent.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          actorUserId: access.userId,
          action: "delivery_note.created",
          targetType: "delivery_note",
          targetPublicId: document.publicId,
          requestId,
        },
      });

      return this.mapDeliveryNote(document);
    });
  }

  async list(userPublicId: string, businessPublicId: string): Promise<DeliveryNote[]> {
    const access = await this.authorize(userPublicId, businessPublicId, "read");
    return this.database.withScope(access, async (transaction) => {
      const records = (await transaction.document.findMany({
        where: { businessId: access.businessId, type: DocumentType.DELIVERY_NOTE },
        include: this.detailInclude(),
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 200,
      })) as unknown as DeliveryNoteRecord[];
      return records.map((record) => this.mapDeliveryNote(record));
    });
  }

  async get(
    userPublicId: string,
    businessPublicId: string,
    deliveryNotePublicId: string,
  ): Promise<DeliveryNote> {
    const access = await this.authorize(userPublicId, businessPublicId, "read");
    return this.database.withScope(access, async (transaction) => {
      const record = await this.findRecord(transaction, access, deliveryNotePublicId);
      return this.mapDeliveryNote(record);
    });
  }

  async markDelivered(
    userPublicId: string,
    businessPublicId: string,
    deliveryNotePublicId: string,
    requestId: string,
  ): Promise<DeliveryNote> {
    const access = await this.authorize(userPublicId, businessPublicId, "update");
    return this.database.withScope(access, async (transaction) => {
      const existing = await this.findRecord(transaction, access, deliveryNotePublicId);

      const updated = (await transaction.document.update({
        where: { id: existing.id },
        data: { receivedAt: new Date() },
        include: this.detailInclude(),
      })) as unknown as DeliveryNoteRecord;

      await transaction.auditEvent.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          actorUserId: access.userId,
          action: "delivery_note.delivered",
          targetType: "delivery_note",
          targetPublicId: updated.publicId,
          requestId,
        },
      });

      return this.mapDeliveryNote(updated);
    });
  }

  private async authorize(
    userPublicId: string,
    businessPublicId: string,
    action: AuthorizationAction,
  ): Promise<BusinessAccessContext> {
    const access = await this.businessAccess.resolve(userPublicId, businessPublicId);
    await this.businessAccess.assertAllowed(access, "delivery_notes", action);
    return access;
  }

  private detailInclude() {
    return {
      customer: true,
      lines: { orderBy: { position: "asc" as const } },
      sourceDocument: { select: { publicId: true, number: true } },
    } satisfies Prisma.DocumentInclude;
  }

  private async findRecord(
    transaction: Prisma.TransactionClient,
    access: BusinessAccessContext,
    deliveryNotePublicId: string,
  ): Promise<DeliveryNoteRecord> {
    const record = (await transaction.document.findFirst({
      where: {
        businessId: access.businessId,
        publicId: deliveryNotePublicId,
        type: DocumentType.DELIVERY_NOTE,
      },
      include: this.detailInclude(),
    })) as unknown as DeliveryNoteRecord | null;
    if (!record) {
      throw new NotFoundException("We could not find that delivery note.");
    }
    return record;
  }

  private mapDeliveryNote(record: DeliveryNoteRecord): DeliveryNote {
    return {
      id: record.publicId,
      number: record.number,
      status: record.receivedAt ? "DELIVERED" : "DRAFT",
      deliveryDate: record.deliveryDate ? this.dateOnly(record.deliveryDate) : null,
      notes: record.notes,
      customer: {
        id: record.customer.publicId,
        name: record.customer.name,
        email: record.customer.email,
        phone: record.customer.phone,
      },
      salesOrder: record.sourceDocument
        ? { id: record.sourceDocument.publicId, number: record.sourceDocument.number }
        : null,
      lines: record.lines.map((line) => ({
        position: line.position,
        description: line.description,
        quantity: line.quantity.toString(),
      })),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private dateOnly(value: Date): string {
    return value.toISOString().slice(0, 10);
  }
}
