import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import { type CreateCreditNoteRequest, type CreditNote } from "@bizo/contracts/credit-notes";
import { DocumentStatus, DocumentType, type Prisma } from "@bizo/database";

import { DatabaseService } from "../database/database.service";
import { allocateDocumentNumber } from "../numbering/numbering";
import {
  type AuthorizationAction,
  type BusinessAccessContext,
  BusinessAccessService,
} from "../security/business-access.service";
import { calculateDocumentTotals } from "../documents/document-calculator.js";

interface DecimalLike {
  toString(): string;
}

interface CreditNoteLineRecord {
  description: string;
  position: number;
  quantity: DecimalLike;
  subtotalMinor: DecimalLike;
  taxMinor: DecimalLike;
  taxRatePpm: number;
  totalMinor: DecimalLike;
  unitPriceMinor: DecimalLike;
}

interface CreditNoteRecord {
  createdAt: Date;
  currencyCode: string;
  currencyScale: number;
  customer: { email: string | null; name: string; phone: string | null; publicId: string };
  id: bigint;
  issueDate: Date;
  lines: CreditNoteLineRecord[];
  notes: string | null;
  number: string;
  publicId: string;
  reason: string;
  referenceDocument: { number: string; publicId: string } | null;
  status: DocumentStatus;
  subtotalMinor: DecimalLike;
  taxMinor: DecimalLike;
  totalMinor: DecimalLike;
  updatedAt: Date;
}

@Injectable()
export class CreditNotesService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(BusinessAccessService) private readonly businessAccess: BusinessAccessService,
  ) {}

  async create(
    userPublicId: string,
    businessPublicId: string,
    input: CreateCreditNoteRequest,
    requestId: string,
  ): Promise<CreditNote> {
    const access = await this.authorize(userPublicId, businessPublicId, "create");

    return this.database.withScope(access, async (transaction) => {
      const business = await transaction.business.findUniqueOrThrow({
        where: { id: access.businessId },
        include: { settings: true },
      });
      const settings = business.settings;
      if (!settings) throw new Error("Business settings are incomplete.");

      const customer = await transaction.customer.findFirst({
        where: { businessId: access.businessId, publicId: input.customerId },
      });
      if (!customer) throw new NotFoundException("We could not find that customer.");

      let referenceDocumentId: bigint | null = null;
      if (input.referenceInvoiceId) {
        const invoice = await transaction.document.findFirst({
          where: {
            businessId: access.businessId,
            publicId: input.referenceInvoiceId,
            type: DocumentType.INVOICE,
          },
        });
        if (!invoice) throw new NotFoundException("We could not find that invoice.");
        referenceDocumentId = invoice.id;
      }

      const {
        lines: calculatedLines,
        subtotalMinor,
        taxMinor,
        totalMinor,
      } = calculateDocumentTotals(input.lines, business.currencyScale);

      const allocated = await allocateDocumentNumber(transaction, access.businessId, "CREDIT_NOTE");
      const issueDate = input.issueDate ?? this.localDate(business.timeZone);

      const document = (await transaction.document.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          customerId: customer.id,
          type: DocumentType.CREDIT_NOTE,
          status: DocumentStatus.DRAFT,
          number: allocated.number,
          issueDate: this.toDatabaseDate(issueDate),
          // `documents` is shared with quotations, where valid_until is the offer expiry, so the
          // column is NOT NULL with no default. A credit note does not expire; without a value
          // here every create fails with
          // `null value in column "valid_until" violates not-null constraint`.
          validUntil: this.toDatabaseDate(issueDate),
          currencyCode: business.baseCurrency,
          currencyScale: business.currencyScale,
          subtotalMinor: subtotalMinor.toString(),
          taxMinor: taxMinor.toString(),
          totalMinor: totalMinor.toString(),
          notes: input.notes ?? null,
          referenceDocumentId,
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
      })) as unknown as CreditNoteRecord;

      await transaction.auditEvent.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          actorUserId: access.userId,
          action: "credit_note.created",
          targetType: "credit_note",
          targetPublicId: document.publicId,
          requestId,
        },
      });

      return this.mapCreditNote(document, transaction);
    });
  }

  async list(userPublicId: string, businessPublicId: string): Promise<CreditNote[]> {
    const access = await this.authorize(userPublicId, businessPublicId, "read");
    return this.database.withScope(access, async (transaction) => {
      const records = (await transaction.document.findMany({
        where: { businessId: access.businessId, type: DocumentType.CREDIT_NOTE },
        include: this.detailInclude(),
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 200,
      })) as unknown as CreditNoteRecord[];
      const mapped: CreditNote[] = [];
      for (const record of records) mapped.push(await this.mapCreditNote(record, transaction));
      return mapped;
    });
  }

  async get(
    userPublicId: string,
    businessPublicId: string,
    creditNotePublicId: string,
  ): Promise<CreditNote> {
    const access = await this.authorize(userPublicId, businessPublicId, "read");
    return this.database.withScope(access, async (transaction) => {
      const record = await this.findRecord(transaction, access, creditNotePublicId);
      return this.mapCreditNote(record, transaction);
    });
  }

  async issue(
    userPublicId: string,
    businessPublicId: string,
    creditNotePublicId: string,
    requestId: string,
  ): Promise<CreditNote> {
    const access = await this.authorize(userPublicId, businessPublicId, "update");
    return this.database.withScope(access, async (transaction) => {
      const existing = await this.findRecord(transaction, access, creditNotePublicId);
      if (existing.status !== DocumentStatus.DRAFT)
        throw new BadRequestException("Only draft credit notes can be issued.");

      const updated = (await transaction.document.update({
        where: { id: existing.id },
        data: { status: DocumentStatus.SENT },
        include: this.detailInclude(),
      })) as unknown as CreditNoteRecord;

      await transaction.auditEvent.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          actorUserId: access.userId,
          action: "credit_note.issued",
          targetType: "credit_note",
          targetPublicId: updated.publicId,
          requestId,
        },
      });

      return this.mapCreditNote(updated, transaction);
    });
  }

  private async authorize(
    userPublicId: string,
    businessPublicId: string,
    action: AuthorizationAction,
  ): Promise<BusinessAccessContext> {
    const access = await this.businessAccess.resolve(userPublicId, businessPublicId);
    await this.businessAccess.assertAllowed(access, "credit_notes", action);
    return access;
  }

  private detailInclude() {
    return {
      customer: true,
      lines: { orderBy: { position: "asc" as const } },
      referenceDocument: { select: { publicId: true, number: true } },
    } satisfies Prisma.DocumentInclude;
  }

  private async findRecord(
    transaction: Prisma.TransactionClient,
    access: BusinessAccessContext,
    creditNotePublicId: string,
  ): Promise<CreditNoteRecord> {
    const record = (await transaction.document.findFirst({
      where: {
        businessId: access.businessId,
        publicId: creditNotePublicId,
        type: DocumentType.CREDIT_NOTE,
      },
      include: this.detailInclude(),
    })) as unknown as CreditNoteRecord | null;
    if (!record) throw new NotFoundException("We could not find that credit note.");
    return record;
  }

  private async mapCreditNote(
    record: CreditNoteRecord,
    transaction: Prisma.TransactionClient,
  ): Promise<CreditNote> {
    const allocations = await transaction.creditNoteAllocation.findMany({
      where: { creditNoteId: record.id },
      select: {
        publicId: true,
        amountMinor: true,
        createdAt: true,
        invoice: { select: { publicId: true } },
      },
    } satisfies Prisma.CreditNoteAllocationFindManyArgs);

    return {
      id: record.publicId,
      number: record.number,
      status: this.mapStatus(record.status),
      reason: record.reason as CreditNote["reason"],
      issueDate: this.dateOnly(record.issueDate),
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
      },
      referenceInvoice: record.referenceDocument
        ? { id: record.referenceDocument.publicId, number: record.referenceDocument.number }
        : null,
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
      allocations: allocations.map(
        (a: {
          publicId: string;
          amountMinor: { toFixed: (n: number) => string };
          createdAt: Date;
          invoice: { publicId: string };
        }) => ({
          id: a.publicId,
          invoiceId: a.invoice.publicId,
          amountMinor: a.amountMinor.toFixed(0),
          createdAt: a.createdAt.toISOString(),
        }),
      ),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private mapStatus(status: DocumentStatus): CreditNote["status"] {
    switch (status) {
      case DocumentStatus.DRAFT:
        return "DRAFT";
      case DocumentStatus.SENT:
        return "ISSUED";
      case DocumentStatus.ARCHIVED:
        return "CANCELLED";
      default:
        return "APPLIED";
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
