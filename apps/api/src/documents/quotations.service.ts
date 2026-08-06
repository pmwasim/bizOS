import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";

import {
  type Quotation,
  type SaveQuotationRequest,
  type SendQuotationRequest,
} from "@bizo/contracts/quotations";
import { DeliveryStatus, DocumentStatus, DocumentType, type Prisma } from "@bizo/database";

import { ConfigurationService } from "../configuration/configuration.service.js";
import { DatabaseService } from "../database/database.service.js";
import { MailService } from "../mail/mail.service.js";
import {
  type BusinessAccessContext,
  BusinessAccessService,
} from "../security/business-access.service.js";
import { PdfService } from "./pdf.service.js";
import { calculateQuotation } from "./quotation-calculator.js";
import { type QuotationSnapshot } from "./quotation-snapshot.js";
import { ErpnextClient } from "../erpnext/erpnext.client.js";
import { ERPNEXT_CLIENT } from "../erpnext/erpnext.module.js";

interface DecimalLike {
  toString(): string;
}

interface QuotationRecord {
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
  id: bigint;
  issueDate: Date;
  lines: Array<{
    description: string;
    position: number;
    quantity: DecimalLike;
    subtotalMinor: DecimalLike;
    taxMinor: DecimalLike;
    taxRatePpm: number;
    totalMinor: DecimalLike;
    unitPriceMinor: DecimalLike;
  }>;
  number: string;
  publicId: string;
  sentAt: Date | null;
  status: DocumentStatus;
  subtotalMinor: DecimalLike;
  taxMinor: DecimalLike;
  totalMinor: DecimalLike;
  updatedAt: Date;
  validUntil: Date;
  version: number;
}

interface SnapshotContext {
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  email: string | null;
  legalName: string | null;
  name: string;
  phone: string | null;
  postalCode: string | null;
  settings: {
    quotationPrefix: string;
    quotationValidityDays: number;
    nextQuotationNumber: number;
  };
  taxProfile: {
    name: string;
    registrationNumber: string | null;
  };
  timeZone: string;
}

@Injectable()
export class QuotationsService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(BusinessAccessService) private readonly businessAccess: BusinessAccessService,
    @Inject(PdfService) private readonly pdf: PdfService,
    @Inject(MailService) private readonly mail: MailService,
    @Inject(ERPNEXT_CLIENT) private readonly erpnext: ErpnextClient,
    @Inject(ConfigurationService) private readonly configuration: ConfigurationService,
  ) {}

  async create(
    userPublicId: string,
    businessPublicId: string,
    input: SaveQuotationRequest,
    requestId: string,
  ): Promise<Quotation> {
    const access = await this.authorize(userPublicId, businessPublicId, "create");

    const quotation = await this.database.withScope(access, async (transaction) => {
      const business = (await transaction.business.findUniqueOrThrow({
        where: { id: access.businessId },
        include: { settings: true, taxProfile: true },
      })) as unknown as SnapshotContext & {
        baseCurrency: string;
        currencyScale: number;
      };
      if (!business.settings || !business.taxProfile) {
        throw new Error("Business settings are incomplete.");
      }
      const customer = await transaction.customer.findFirst({
        where: { businessId: access.businessId, publicId: input.customerId },
      });
      if (!customer) {
        throw new NotFoundException("We could not find that customer.");
      }

      let calculated: ReturnType<typeof calculateQuotation>;
      try {
        calculated = calculateQuotation(input, business.currencyScale);
      } catch (error) {
        throw new BadRequestException({
          code: "INVALID_QUOTATION_TOTAL",
          detail: error instanceof Error ? error.message : "Check the quotation amounts.",
        });
      }

      const settings = (await transaction.businessSettings.update({
        where: { businessId: access.businessId },
        data: { nextQuotationNumber: { increment: 1 } },
        select: { nextQuotationNumber: true, quotationPrefix: true, quotationValidityDays: true },
      })) as {
        nextQuotationNumber: number;
        quotationPrefix: string;
        quotationValidityDays: number;
      };
      const sequence = settings.nextQuotationNumber - 1;
      const issueDate = input.issueDate ?? this.localDate(business.timeZone);
      const validUntil =
        input.validUntil ?? this.addDays(issueDate, settings.quotationValidityDays);
      if (validUntil < issueDate) {
        throw new BadRequestException({
          code: "INVALID_VALIDITY_DATE",
          detail: "The valid-until date must be on or after the issue date.",
        });
      }

      const document = (await transaction.document.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          customerId: customer.id,
          type: DocumentType.QUOTATION,
          number: `${settings.quotationPrefix}-${String(sequence).padStart(4, "0")}`,
          issueDate: this.toDatabaseDate(issueDate),
          validUntil: this.toDatabaseDate(validUntil),
          currencyCode: business.baseCurrency,
          currencyScale: business.currencyScale,
          subtotalMinor: calculated.subtotalMinor.toString(),
          taxMinor: calculated.taxMinor.toString(),
          totalMinor: calculated.totalMinor.toString(),
          createdByMembershipId: access.membershipId,
          lines: {
            create: calculated.lines.map((line): Prisma.DocumentLineCreateWithoutDocumentInput => ({
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
        include: { customer: true, lines: { orderBy: { position: "asc" } } },
      })) as unknown as QuotationRecord;

      await transaction.auditEvent.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          actorUserId: access.userId,
          action: "quotation.created",
          targetType: "quotation",
          targetPublicId: document.publicId,
          requestId,
        },
      });

      if (this.erpnext.isConfigured()) {
        try {
          await this.erpnext.createDocument("Quotation", {
            customer: customer.name,
            transaction_date: issueDate.toISOString().split("T")[0],
            valid_till: validUntil.toISOString().split("T")[0],
            items: calculated.lines.map((line) => ({
              item_name: line.description,
              qty: parseFloat(line.quantity.toString()),
              rate: parseFloat(line.unitPriceMinor.toString()) / (10 ** business.currencyScale),
            })),
          });
        } catch (error) {
          console.error("Failed to sync quotation to ERPNext:", error);
        }
      }

      return this.mapQuotation(document);
    });

    await this.configuration.createDocumentWorkflowContext({
      userPublicId,
      businessPublicId,
      documentId: quotation.id,
      documentType: "QUOTATION",
    });

    return quotation;
  }

  async list(userPublicId: string, businessPublicId: string): Promise<Quotation[]> {
    const access = await this.authorize(userPublicId, businessPublicId, "read");
    return this.database.withScope(access, async (transaction) => {
      const records = await transaction.document.findMany({
        where: { businessId: access.businessId, type: DocumentType.QUOTATION },
        include: { customer: true, lines: { orderBy: { position: "asc" } } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 200,
      });
      return (records as unknown as QuotationRecord[]).map((record) => this.mapQuotation(record));
    });
  }

  async get(
    userPublicId: string,
    businessPublicId: string,
    quotationPublicId: string,
  ): Promise<Quotation> {
    const access = await this.authorize(userPublicId, businessPublicId, "read");
    const record = await this.findRecord(access, quotationPublicId);
    return this.mapQuotation(record);
  }

  async renderPdf(
    userPublicId: string,
    businessPublicId: string,
    quotationPublicId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const access = await this.authorize(userPublicId, businessPublicId, "export");
    const { record, snapshot } = await this.loadSnapshot(access, quotationPublicId);
    return {
      buffer: await this.pdf.renderQuotation(snapshot),
      filename: `${record.number}.pdf`,
    };
  }

  async send(
    userPublicId: string,
    businessPublicId: string,
    quotationPublicId: string,
    input: SendQuotationRequest,
    requestId: string,
  ): Promise<{
    delivery: { id: string; recipientEmail: string; sentAt: string; status: "SENT" };
    quotation: Quotation;
  }> {
    const access = await this.authorize(userPublicId, businessPublicId, "send");
    const finalized = await this.database.withScope(access, async (transaction) => {
      const record = await this.findRecordInTransaction(transaction, access, quotationPublicId);
      const context = await this.loadSnapshotContext(transaction, access);
      let snapshot: QuotationSnapshot;
      let updated = record;

      if (record.status === DocumentStatus.DRAFT) {
        snapshot = this.buildSnapshot(record, context);
        await transaction.documentVersion.create({
          data: {
            tenantId: access.tenantId,
            businessId: access.businessId,
            documentId: record.id,
            version: record.version,
            snapshot: snapshot as unknown as Prisma.InputJsonValue,
          },
        });
        const sentAt = new Date();
        updated = (await transaction.document.update({
          where: { id: record.id },
          data: { status: DocumentStatus.SENT, sentAt },
          include: { customer: true, lines: { orderBy: { position: "asc" } } },
        })) as unknown as QuotationRecord;
      } else {
        const version = await transaction.documentVersion.findFirst({
          where: {
            businessId: access.businessId,
            documentId: record.id,
            version: record.version,
          },
          select: { snapshot: true },
        });
        if (!version) {
          throw new Error("The finalized quotation snapshot is missing.");
        }
        snapshot = version.snapshot as unknown as QuotationSnapshot;
      }

      const delivery = await transaction.documentDelivery.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          documentId: record.id,
          documentVersion: record.version,
          recipientEmail: input.recipientEmail,
          message: input.message,
        },
      });
      await transaction.auditEvent.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          actorUserId: access.userId,
          action:
            record.status === DocumentStatus.DRAFT
              ? "quotation.finalized"
              : "quotation.delivery_retried",
          targetType: "quotation",
          targetPublicId: record.publicId,
          requestId,
        },
      });
      return { context, delivery, record: updated, snapshot };
    });

    const attachment = await this.pdf.renderQuotation(finalized.snapshot);
    let providerMessageId: string;
    try {
      providerMessageId = await this.mail.sendQuotation({
        attachment,
        body: input.message,
        businessName: finalized.context.name,
        filename: `${finalized.record.number}.pdf`,
        quotationNumber: finalized.record.number,
        recipient: input.recipientEmail,
      });
    } catch (error) {
      await this.updateDelivery(
        access,
        finalized.delivery.id,
        DeliveryStatus.FAILED,
        undefined,
        this.safeFailureReason(error),
      );
      throw new ServiceUnavailableException({
        code: "DELIVERY_FAILED",
        detail:
          "The quotation is saved, but the email could not be sent. You can retry from the quotation.",
      });
    }

    const sentAt = new Date();
    await this.updateDelivery(
      access,
      finalized.delivery.id,
      DeliveryStatus.SENT,
      providerMessageId,
      undefined,
      sentAt,
    );

    return {
      quotation: this.mapQuotation(finalized.record),
      delivery: {
        id: finalized.delivery.publicId,
        status: "SENT",
        recipientEmail: input.recipientEmail,
        sentAt: sentAt.toISOString(),
      },
    };
  }

  private async authorize(
    userPublicId: string,
    businessPublicId: string,
    action: "create" | "export" | "read" | "send",
  ): Promise<BusinessAccessContext> {
    const access = await this.businessAccess.resolve(userPublicId, businessPublicId);
    await this.businessAccess.assertAllowed(access, "quotations", action);
    return access;
  }

  private async findRecord(
    access: BusinessAccessContext,
    quotationPublicId: string,
  ): Promise<QuotationRecord> {
    return this.database.withScope(access, (transaction) =>
      this.findRecordInTransaction(transaction, access, quotationPublicId),
    );
  }

  private async findRecordInTransaction(
    transaction: Prisma.TransactionClient,
    access: BusinessAccessContext,
    quotationPublicId: string,
  ): Promise<QuotationRecord> {
    const record = await transaction.document.findFirst({
      where: {
        businessId: access.businessId,
        publicId: quotationPublicId,
        type: DocumentType.QUOTATION,
      },
      include: { customer: true, lines: { orderBy: { position: "asc" } } },
    });
    if (!record) {
      throw new NotFoundException("We could not find that quotation.");
    }
    return record as unknown as QuotationRecord;
  }

  private async loadSnapshot(
    access: BusinessAccessContext,
    quotationPublicId: string,
  ): Promise<{ record: QuotationRecord; snapshot: QuotationSnapshot }> {
    return this.database.withScope(access, async (transaction) => {
      const record = await this.findRecordInTransaction(transaction, access, quotationPublicId);
      if (record.status === DocumentStatus.SENT) {
        const version = await transaction.documentVersion.findFirst({
          where: {
            businessId: access.businessId,
            documentId: record.id,
            version: record.version,
          },
          select: { snapshot: true },
        });
        if (!version) {
          throw new Error("The finalized quotation snapshot is missing.");
        }
        return {
          record,
          snapshot: version.snapshot as unknown as QuotationSnapshot,
        };
      }
      const context = await this.loadSnapshotContext(transaction, access);
      return { record, snapshot: this.buildSnapshot(record, context) };
    });
  }

  private async loadSnapshotContext(
    transaction: Prisma.TransactionClient,
    access: BusinessAccessContext,
  ): Promise<SnapshotContext> {
    const context = await transaction.business.findUniqueOrThrow({
      where: { id: access.businessId },
      include: { settings: true, taxProfile: true },
    });
    return context as unknown as SnapshotContext;
  }

  private buildSnapshot(record: QuotationRecord, context: SnapshotContext): QuotationSnapshot {
    return {
      business: {
        name: context.name,
        legalName: context.legalName,
        email: context.email,
        phone: context.phone,
        address: this.address(context),
        taxName: context.taxProfile.name,
        taxRegistrationNumber: context.taxProfile.registrationNumber,
      },
      customer: {
        name: record.customer.name,
        email: record.customer.email,
        phone: record.customer.phone,
        address: this.address(record.customer),
      },
      number: record.number,
      issueDate: this.dateOnly(record.issueDate),
      validUntil: this.dateOnly(record.validUntil),
      currencyCode: record.currencyCode,
      currencyScale: record.currencyScale,
      subtotalMinor: record.subtotalMinor.toString(),
      taxMinor: record.taxMinor.toString(),
      totalMinor: record.totalMinor.toString(),
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
    };
  }

  private mapQuotation(record: QuotationRecord): Quotation {
    return {
      id: record.publicId,
      number: record.number,
      status: record.status as Quotation["status"],
      issueDate: this.dateOnly(record.issueDate),
      validUntil: this.dateOnly(record.validUntil),
      currencyCode: record.currencyCode,
      currencyScale: record.currencyScale,
      subtotalMinor: record.subtotalMinor.toString(),
      taxMinor: record.taxMinor.toString(),
      totalMinor: record.totalMinor.toString(),
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
      sentAt: record.sentAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private async updateDelivery(
    access: BusinessAccessContext,
    deliveryId: bigint,
    status: DeliveryStatus,
    providerMessageId?: string,
    failureReason?: string,
    sentAt?: Date,
  ): Promise<void> {
    await this.database.withScope(access, async (transaction) => {
      await transaction.documentDelivery.update({
        where: { id: deliveryId },
        data: {
          status,
          providerMessageId,
          failureReason,
          sentAt,
        },
      });
    });
  }

  private address(value: {
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    postalCode: string | null;
  }): string[] {
    return [
      value.addressLine1,
      value.addressLine2,
      [value.city, value.postalCode].filter(Boolean).join(" "),
    ].filter((line): line is string => Boolean(line));
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

  private addDays(date: string, days: number): string {
    const value = this.toDatabaseDate(date);
    value.setUTCDate(value.getUTCDate() + days);
    return this.dateOnly(value);
  }

  private toDatabaseDate(value: string): Date {
    return new Date(`${value}T00:00:00.000Z`);
  }

  private dateOnly(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private safeFailureReason(error: unknown): string {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code: unknown }).code)
        : "SMTP_ERROR";
    return code.slice(0, 500);
  }
}
