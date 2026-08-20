import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";

import { formatScaledInteger } from "@bizo/contracts/money";
import {
  type CreateInvoiceFromQuotationRequest,
  type Invoice,
  type InvoiceStatus,
  type SendInvoiceRequest,
  type UpdateInvoiceRequest,
} from "@bizo/contracts/invoices";
import {
  bestReadiness,
  canCreateInvoiceFromQuotation,
  derivePurchaseOrderReadiness,
  type Readiness,
} from "@bizo/contracts/purchase-orders";
import {
  DeliveryStatus,
  DocumentStatus,
  DocumentType,
  type Prisma,
  PurchaseOrderStatus,
  StoredObjectKind,
} from "@bizo/database";
import { invoicePdfObjectKey, sha256Hex, type ObjectStore } from "@bizo/storage";

import { ConfigurationService } from "../configuration/configuration.service.js";
import { DatabaseService } from "../database/database.service.js";
import { MailService } from "../mail/mail.service.js";
import {
  type AuthorizationAction,
  type BusinessAccessContext,
  BusinessAccessService,
} from "../security/business-access.service.js";
import { OBJECT_STORE } from "../storage/object-store.token.js";
import { calculateInvoice } from "./invoice-calculator.js";
import { type InvoiceSnapshot } from "./invoice-snapshot.js";
import {
  buildZatcaQrFromSnapshot,
  buildZatcaXmlFromSnapshot,
  isZatcaCountry,
} from "./zatca-invoice.js";
import { PdfService } from "./pdf.service.js";
import { type ErpnextClient } from "../erpnext/erpnext.client.js";
import { ERPNEXT_CLIENT } from "../erpnext/erpnext.module.js";

interface DecimalLike {
  toString(): string;
}

interface InvoiceLineRecord {
  description: string;
  position: number;
  quantity: DecimalLike;
  subtotalMinor: DecimalLike;
  taxMinor: DecimalLike;
  taxRatePpm: number;
  totalMinor: DecimalLike;
  unitPriceMinor: DecimalLike;
}

interface QuotationForInvoice {
  currencyCode: string;
  currencyScale: number;
  customer: { name: string };
  customerId: bigint;
  id: bigint;
  lines: InvoiceLineRecord[];
  publicId: string;
  status: DocumentStatus;
  subtotalMinor: DecimalLike;
  taxMinor: DecimalLike;
  totalMinor: DecimalLike;
}

interface ReadyPurchaseOrderRef {
  id: bigint;
  poNumber: string;
  projectReference: string | null;
  publicId: string;
}

interface InvoiceRecord {
  archivedAt: Date | null;
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
  deliveries?: Array<{
    failureReason: string | null;
    publicId: string;
    recipientEmail: string;
    sentAt: Date | null;
    status: DeliveryStatus;
  }>;
  dueDate: Date | null;
  id: bigint;
  issueDate: Date;
  lines: InvoiceLineRecord[];
  linkedPurchaseOrder: { poNumber: string; publicId: string } | null;
  notes: string | null;
  number: string;
  poNumberSnapshot: string | null;
  projectReference: string | null;
  publicId: string;
  purchaseOrderId: bigint | null;
  sentAt: Date | null;
  sourceQuotation: { number: string; publicId: string } | null;
  sourceQuotationId: bigint | null;
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
  countryCode: string;
  email: string | null;
  legalName: string | null;
  name: string;
  phone: string | null;
  postalCode: string | null;
  settings: {
    invoiceDueDays: number;
    invoicePrefix: string;
    nextInvoiceNumber: number;
  };
  taxProfile: {
    name: string;
    registrationNumber: string | null;
  };
  timeZone: string;
}

const EDITABLE_STATUSES = new Set<DocumentStatus>([
  DocumentStatus.DRAFT,
  DocumentStatus.READY_TO_SEND,
]);

const FINALIZED_STATUSES = new Set<DocumentStatus>([
  DocumentStatus.SENT,
  DocumentStatus.SEND_FAILED,
]);

const ARCHIVEABLE_STATUSES = new Set<DocumentStatus>([
  DocumentStatus.DRAFT,
  DocumentStatus.READY_TO_SEND,
  DocumentStatus.SENT,
  DocumentStatus.SEND_FAILED,
]);

@Injectable()
export class InvoicesService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(BusinessAccessService) private readonly businessAccess: BusinessAccessService,
    @Inject(PdfService) private readonly pdf: PdfService,
    @Inject(MailService) private readonly mail: MailService,
    @Inject(OBJECT_STORE) private readonly objectStore: ObjectStore,
    @Inject(ERPNEXT_CLIENT) private readonly erpnext: ErpnextClient,
    @Inject(ConfigurationService) private readonly configuration: ConfigurationService,
  ) {}

  async createFromQuotation(
    userPublicId: string,
    businessPublicId: string,
    input: CreateInvoiceFromQuotationRequest,
    requestId: string,
  ): Promise<Invoice> {
    const access = await this.authorize(userPublicId, businessPublicId, "create");
    const conversionPolicy = await this.configuration.getInvoiceConversionPolicy(
      userPublicId,
      businessPublicId,
    );

    const invoice = await this.database.withScope(access, async (transaction) => {
      const quotation = await transaction.document.findFirst({
        where: {
          businessId: access.businessId,
          publicId: input.quotationId,
          type: DocumentType.QUOTATION,
        },
        include: { customer: true, lines: { orderBy: { position: "asc" } } },
      });
      if (!quotation) {
        throw new NotFoundException("We could not find that quotation.");
      }

      const { readyPo } = await this.resolveQuotationReadiness(
        transaction,
        access,
        quotation,
        conversionPolicy,
      );

      const business = (await transaction.business.findUniqueOrThrow({
        where: { id: access.businessId },
        include: { settings: true, taxProfile: true },
      })) as unknown as SnapshotContext & { baseCurrency: string; currencyScale: number };
      if (!business.settings || !business.taxProfile) {
        throw new Error("Business settings are incomplete.");
      }

      const document = await this.persistInvoiceFromQuotation(
        transaction,
        access,
        quotation as unknown as QuotationForInvoice,
        business,
        requestId,
        {
          status: DocumentStatus.READY_TO_SEND,
          readyPo,
          auditAfter: { configurationTemplateCode: conversionPolicy.templateCode },
        },
      );

      return this.mapInvoice(document);
    });

    await this.configuration.createDocumentWorkflowContext({
      userPublicId,
      businessPublicId,
      documentId: invoice.id,
      documentType: "INVOICE",
    });

    return invoice;
  }

  /**
   * Apply the configuration-aware purchase-order readiness gate for turning a quotation into an
   * invoice. Rolls up the readiness of every ACTIVE purchase order linked to the quotation and
   * throws {@link BadRequestException} unless the configured policy allows the conversion. Shared by
   * {@link createFromQuotation} and {@link convertFromQuotation} so both honour the same gate.
   */
  private async resolveQuotationReadiness(
    transaction: Prisma.TransactionClient,
    access: BusinessAccessContext,
    quotation: { id: bigint; status: DocumentStatus },
    conversionPolicy: { customerPoRequired: boolean },
  ): Promise<{ readyPo: ReadyPurchaseOrderRef | null }> {
    type ReadyPurchaseOrder = {
      approvalStatus: Parameters<typeof derivePurchaseOrderReadiness>[0]["approvalStatus"];
      id: bigint;
      poNumber: string;
      projectReference: string | null;
      publicId: string;
      status: PurchaseOrderStatus;
      storedObjects: Array<{ kind: StoredObjectKind }>;
    };
    const linkedPurchaseOrders = (await transaction.purchaseOrder.findMany({
      where: {
        businessId: access.businessId,
        quotationId: quotation.id,
        status: PurchaseOrderStatus.ACTIVE,
      },
      include: {
        storedObjects: {
          where: {
            supersededAt: null,
            kind: { in: [StoredObjectKind.PURCHASE_ORDER, StoredObjectKind.APPROVAL_EVIDENCE] },
          },
          select: { kind: true },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    })) as unknown as ReadyPurchaseOrder[];

    const readinessItems: Array<{ po: ReadyPurchaseOrder; readiness: Readiness }> =
      linkedPurchaseOrders.map((po) => ({
        po,
        readiness: derivePurchaseOrderReadiness({
          status: po.status,
          approvalStatus: po.approvalStatus,
          hasPoFile: po.storedObjects.some((item) => item.kind === StoredObjectKind.PURCHASE_ORDER),
          hasApprovalEvidence: po.storedObjects.some(
            (item) => item.kind === StoredObjectKind.APPROVAL_EVIDENCE,
          ),
          quotationLinked: true,
        }),
      }));
    const rollup = bestReadiness(
      readinessItems.map((item) => item.readiness),
      { customerPoRequired: conversionPolicy.customerPoRequired },
    );
    if (
      !canCreateInvoiceFromQuotation({
        customerPoRequired: conversionPolicy.customerPoRequired,
        quotationStatus: quotation.status,
        purchaseOrderReadiness: rollup,
      })
    ) {
      throw new BadRequestException({
        code: "QUOTATION_NOT_READY",
        detail: conversionPolicy.customerPoRequired
          ? "This quotation is not ready to invoice yet. Finish purchase-order approval first."
          : "Send the quotation before creating an invoice.",
      });
    }
    const readyPo =
      readinessItems.find((item) => item.readiness.code === "READY_TO_INVOICE")?.po ?? null;
    return { readyPo };
  }

  /**
   * One-click conversion of an accepted quotation into a DRAFT invoice. Copies the quotation's
   * customer, line items, and tax rates into a new invoice through the same creation path as
   * {@link createFromQuotation} (see {@link persistInvoiceFromQuotation}).
   *
   * Idempotent: a quotation that has already been converted returns its existing invoice rather than
   * minting a duplicate. A transaction-scoped Postgres advisory lock keyed on the quotation is taken
   * before the `sourceQuotationId` recheck, so two concurrent conversions of the same quotation
   * serialize and cannot both create an invoice.
   *
   * The same configuration-aware purchase-order readiness gate that {@link createFromQuotation}
   * enforces is applied here, so a business on a PO-approval workflow cannot convert a quotation
   * whose purchase order is not ready to invoice.
   */
  async convertFromQuotation(
    userPublicId: string,
    businessPublicId: string,
    quotationPublicId: string,
    requestId: string,
  ): Promise<Invoice> {
    const access = await this.authorize(userPublicId, businessPublicId, "create");
    const conversionPolicy = await this.configuration.getInvoiceConversionPolicy(
      userPublicId,
      businessPublicId,
    );

    const { created, invoice } = await this.database.withScope(access, async (transaction) => {
      // Serialize concurrent converts of the same quotation. The transaction-scoped advisory lock is
      // released automatically on commit or rollback, so the dedup recheck below is authoritative:
      // a racing convert either has not yet inserted its invoice, or already committed one we will
      // see. Keyed on the quotation's public id (hashed to the bigint the advisory-lock API expects).
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`invoice-convert:${quotationPublicId}`}))`;

      const quotation = (await transaction.document.findFirst({
        where: {
          businessId: access.businessId,
          publicId: quotationPublicId,
          type: DocumentType.QUOTATION,
        },
        include: { customer: true, lines: { orderBy: { position: "asc" } } },
      })) as unknown as QuotationForInvoice | null;
      if (!quotation) {
        throw new NotFoundException("We could not find that quotation.");
      }

      const existing = await transaction.document.findFirst({
        where: {
          businessId: access.businessId,
          type: DocumentType.INVOICE,
          sourceQuotationId: quotation.id,
        },
        include: this.detailInclude(),
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      if (existing) {
        return {
          created: false,
          invoice: this.mapInvoice(existing as unknown as InvoiceRecord),
        };
      }

      const { readyPo } = await this.resolveQuotationReadiness(
        transaction,
        access,
        quotation,
        conversionPolicy,
      );

      const business = (await transaction.business.findUniqueOrThrow({
        where: { id: access.businessId },
        include: { settings: true, taxProfile: true },
      })) as unknown as SnapshotContext & { baseCurrency: string; currencyScale: number };
      if (!business.settings || !business.taxProfile) {
        throw new Error("Business settings are incomplete.");
      }

      const document = await this.persistInvoiceFromQuotation(
        transaction,
        access,
        quotation,
        business,
        requestId,
        { status: DocumentStatus.DRAFT, readyPo },
      );

      return { created: true, invoice: this.mapInvoice(document) };
    });

    if (created) {
      await this.configuration.createDocumentWorkflowContext({
        userPublicId,
        businessPublicId,
        documentId: invoice.id,
        documentType: "INVOICE",
      });
    }

    return invoice;
  }

  /**
   * Shared invoice-creation path: copy a quotation's lines and tax rates, recalculate to prove the
   * copied totals still balance, allocate the next invoice number, and persist the invoice document,
   * its audit event, and the best-effort ERPNext mirror. Callers decide the starting status and any
   * linked purchase order.
   */
  private async persistInvoiceFromQuotation(
    transaction: Prisma.TransactionClient,
    access: BusinessAccessContext,
    quotation: QuotationForInvoice,
    business: SnapshotContext & { currencyScale: number },
    requestId: string,
    options: {
      auditAfter?: Record<string, unknown>;
      readyPo: ReadyPurchaseOrderRef | null;
      status: DocumentStatus;
    },
  ): Promise<InvoiceRecord> {
    const lineInputs = quotation.lines.map((line) => ({
      description: line.description,
      quantity: line.quantity.toString(),
      unitPrice: formatScaledInteger(
        BigInt(line.unitPriceMinor.toString()),
        quotation.currencyScale,
      ),
      taxRatePercent: formatScaledInteger(BigInt(line.taxRatePpm), 4).replace(/\.?0+$/, "") || "0",
    }));

    let calculated: ReturnType<typeof calculateInvoice>;
    try {
      calculated = calculateInvoice({ lines: lineInputs }, quotation.currencyScale);
    } catch (error) {
      throw new BadRequestException({
        code: "INVALID_INVOICE_TOTAL",
        detail: error instanceof Error ? error.message : "Check the invoice amounts.",
      });
    }

    if (
      calculated.subtotalMinor.toString() !== quotation.subtotalMinor.toString() ||
      calculated.taxMinor.toString() !== quotation.taxMinor.toString() ||
      calculated.totalMinor.toString() !== quotation.totalMinor.toString()
    ) {
      throw new BadRequestException({
        code: "INVOICE_TOTAL_MISMATCH",
        detail: "Copied quotation totals did not recalculate to the same amounts.",
      });
    }

    const settings = (await transaction.businessSettings.update({
      where: { businessId: access.businessId },
      data: { nextInvoiceNumber: { increment: 1 } },
      select: {
        invoiceDueDays: true,
        invoicePrefix: true,
        nextInvoiceNumber: true,
      },
    })) as {
      invoiceDueDays: number;
      invoicePrefix: string;
      nextInvoiceNumber: number;
    };
    const sequence = settings.nextInvoiceNumber - 1;
    const issueDate = this.localDate(business.timeZone);
    const dueDate = this.addDays(issueDate, settings.invoiceDueDays);

    const document = (await transaction.document.create({
      data: {
        tenantId: access.tenantId,
        businessId: access.businessId,
        customerId: quotation.customerId,
        type: DocumentType.INVOICE,
        status: options.status,
        number: `${settings.invoicePrefix}-${String(sequence).padStart(4, "0")}`,
        issueDate: this.toDatabaseDate(issueDate),
        validUntil: this.toDatabaseDate(dueDate),
        dueDate: this.toDatabaseDate(dueDate),
        sourceQuotationId: quotation.id,
        purchaseOrderId: options.readyPo?.id ?? null,
        projectReference: options.readyPo?.projectReference ?? null,
        poNumberSnapshot: options.readyPo?.poNumber ?? null,
        currencyCode: quotation.currencyCode,
        currencyScale: quotation.currencyScale,
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
      include: this.detailInclude(),
    })) as unknown as InvoiceRecord;

    await transaction.auditEvent.create({
      data: {
        tenantId: access.tenantId,
        businessId: access.businessId,
        actorUserId: access.userId,
        action: "invoice.created",
        targetType: "invoice",
        targetPublicId: document.publicId,
        requestId,
        after: {
          sourceQuotationId: quotation.publicId,
          purchaseOrderId: options.readyPo?.publicId ?? null,
          status: document.status,
          ...options.auditAfter,
        },
      },
    });

    if (this.erpnext.isConfigured()) {
      try {
        await this.erpnext.createDocument("Sales Invoice", {
          customer: quotation.customer.name,
          posting_date: issueDate,
          due_date: dueDate,
          items: calculated.lines.map((line) => ({
            item_name: line.description,
            qty: parseFloat(line.quantity.toString()),
            rate: parseFloat(line.unitPriceMinor.toString()) / 10 ** business.currencyScale,
          })),
        });
      } catch (error) {
        console.error("Failed to sync invoice to ERPNext:", error);
      }
    }

    return document;
  }

  async list(userPublicId: string, businessPublicId: string): Promise<Invoice[]> {
    const access = await this.authorize(userPublicId, businessPublicId, "read");
    return this.database.withScope(access, async (transaction) => {
      const records = await transaction.document.findMany({
        where: { businessId: access.businessId, type: DocumentType.INVOICE },
        include: this.detailInclude(),
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 200,
      });
      const mapped: Invoice[] = [];
      for (const row of records) {
        const latestDelivery = await transaction.documentDelivery.findFirst({
          where: {
            businessId: access.businessId,
            documentId: row.id,
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: {
            publicId: true,
            status: true,
            recipientEmail: true,
            sentAt: true,
            failureReason: true,
          },
        });
        mapped.push(
          this.mapInvoice({
            ...(row as unknown as InvoiceRecord),
            deliveries: latestDelivery ? [latestDelivery] : [],
          }),
        );
      }
      return mapped;
    });
  }

  async get(
    userPublicId: string,
    businessPublicId: string,
    invoicePublicId: string,
  ): Promise<Invoice> {
    const access = await this.authorize(userPublicId, businessPublicId, "read");
    const record = await this.findRecord(access, invoicePublicId);
    return this.mapInvoice(record);
  }

  async update(
    userPublicId: string,
    businessPublicId: string,
    invoicePublicId: string,
    input: UpdateInvoiceRequest,
    requestId: string,
  ): Promise<Invoice> {
    const access = await this.authorize(userPublicId, businessPublicId, "update");
    return this.database.withScope(access, async (transaction) => {
      const existing = await this.findRecordInTransaction(transaction, access, invoicePublicId);
      if (!EDITABLE_STATUSES.has(existing.status)) {
        throw new BadRequestException({
          code: "INVOICE_NOT_EDITABLE",
          detail: "Only draft or ready-to-send invoices can be edited.",
        });
      }

      let calculated: ReturnType<typeof calculateInvoice>;
      try {
        calculated = calculateInvoice(input, existing.currencyScale);
      } catch (error) {
        throw new BadRequestException({
          code: "INVALID_INVOICE_TOTAL",
          detail: error instanceof Error ? error.message : "Check the invoice amounts.",
        });
      }

      const issueDate = input.issueDate ?? this.dateOnly(existing.issueDate);
      const dueDate = input.dueDate ?? this.dateOnly(existing.dueDate!);
      if (dueDate < issueDate) {
        throw new BadRequestException({
          code: "INVALID_DUE_DATE",
          detail: "The due date must be on or after the issue date.",
        });
      }

      await transaction.documentLine.deleteMany({
        where: { businessId: access.businessId, documentId: existing.id },
      });

      const updated = (await transaction.document.update({
        where: { id: existing.id },
        data: {
          status: DocumentStatus.DRAFT,
          issueDate: this.toDatabaseDate(issueDate),
          dueDate: this.toDatabaseDate(dueDate),
          validUntil: this.toDatabaseDate(dueDate),
          notes: Object.hasOwn(input, "notes") ? input.notes : existing.notes,
          subtotalMinor: calculated.subtotalMinor.toString(),
          taxMinor: calculated.taxMinor.toString(),
          totalMinor: calculated.totalMinor.toString(),
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
        include: this.detailInclude(),
      })) as unknown as InvoiceRecord;

      await transaction.auditEvent.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          actorUserId: access.userId,
          action: "invoice.updated",
          targetType: "invoice",
          targetPublicId: updated.publicId,
          requestId,
          before: { status: existing.status },
          after: { status: updated.status },
        },
      });
      return this.mapInvoice(updated);
    });
  }

  async markReady(
    userPublicId: string,
    businessPublicId: string,
    invoicePublicId: string,
    requestId: string,
  ): Promise<Invoice> {
    const access = await this.authorize(userPublicId, businessPublicId, "update");
    return this.database.withScope(access, async (transaction) => {
      const existing = await this.findRecordInTransaction(transaction, access, invoicePublicId);
      if (existing.status === DocumentStatus.READY_TO_SEND) {
        return this.mapInvoice(existing);
      }
      if (existing.status !== DocumentStatus.DRAFT) {
        throw new BadRequestException({
          code: "INVOICE_NOT_DRAFT",
          detail: "Only draft invoices can be marked ready to send.",
        });
      }
      if (!existing.lines.length || !existing.dueDate) {
        throw new BadRequestException({
          code: "INVOICE_INCOMPLETE",
          detail: "Add at least one line and a due date before marking ready.",
        });
      }

      const updated = (await transaction.document.update({
        where: { id: existing.id },
        data: { status: DocumentStatus.READY_TO_SEND },
        include: this.detailInclude(),
      })) as unknown as InvoiceRecord;

      await transaction.auditEvent.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          actorUserId: access.userId,
          action: "invoice.marked_ready",
          targetType: "invoice",
          targetPublicId: updated.publicId,
          requestId,
          before: { status: existing.status },
          after: { status: updated.status },
        },
      });
      return this.mapInvoice(updated);
    });
  }

  async archive(
    userPublicId: string,
    businessPublicId: string,
    invoicePublicId: string,
    requestId: string,
  ): Promise<Invoice> {
    const access = await this.authorize(userPublicId, businessPublicId, "archive");
    return this.database.withScope(access, async (transaction) => {
      const existing = await this.findRecordInTransaction(transaction, access, invoicePublicId);
      if (existing.status === DocumentStatus.ARCHIVED) {
        return this.mapInvoice(existing);
      }
      if (!ARCHIVEABLE_STATUSES.has(existing.status)) {
        throw new BadRequestException({
          code: "INVOICE_NOT_ARCHIVEABLE",
          detail: "This invoice cannot be archived.",
        });
      }
      const archived = (await transaction.document.update({
        where: { id: existing.id },
        data: {
          status: DocumentStatus.ARCHIVED,
          archivedAt: new Date(),
        },
        include: this.detailInclude(),
      })) as unknown as InvoiceRecord;

      await transaction.auditEvent.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          actorUserId: access.userId,
          action: "invoice.archived",
          targetType: "invoice",
          targetPublicId: archived.publicId,
          requestId,
          before: { status: existing.status },
          after: { status: archived.status },
        },
      });
      return this.mapInvoice(archived);
    });
  }

  async renderPdf(
    userPublicId: string,
    businessPublicId: string,
    invoicePublicId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const access = await this.authorize(userPublicId, businessPublicId, "export");
    const { record, snapshot, pdfStorageKey } = await this.loadSnapshot(access, invoicePublicId);
    if (pdfStorageKey) {
      const stored = await this.objectStore.get(pdfStorageKey);
      return { buffer: stored.body, filename: `${record.number}.pdf` };
    }
    return {
      buffer: await this.pdf.renderInvoice(snapshot),
      filename: `${record.number}.pdf`,
    };
  }

  async send(
    userPublicId: string,
    businessPublicId: string,
    invoicePublicId: string,
    input: SendInvoiceRequest,
    requestId: string,
  ): Promise<{
    delivery: { id: string; recipientEmail: string; sentAt: string; status: "SENT" };
    invoice: Invoice;
  }> {
    const access = await this.authorize(userPublicId, businessPublicId, "send");
    const prepared = await this.database.withScope(access, async (transaction) => {
      const record = await this.findRecordInTransaction(transaction, access, invoicePublicId);
      const context = await this.loadSnapshotContext(transaction, access);
      let snapshot: InvoiceSnapshot;
      let versionPublicId: string;
      let pdfStorageKey: string | null;

      const existingVersion = await transaction.documentVersion.findFirst({
        where: {
          businessId: access.businessId,
          documentId: record.id,
          version: record.version,
        },
        select: { publicId: true, snapshot: true, pdfStorageKey: true },
      });

      if (record.status === DocumentStatus.READY_TO_SEND && !existingVersion) {
        snapshot = this.buildSnapshot(record, context);
        const version = await transaction.documentVersion.create({
          data: {
            tenantId: access.tenantId,
            businessId: access.businessId,
            documentId: record.id,
            version: record.version,
            snapshot: snapshot as unknown as Prisma.InputJsonValue,
          },
          select: { publicId: true },
        });
        versionPublicId = version.publicId;
        pdfStorageKey = null;
        await transaction.auditEvent.create({
          data: {
            tenantId: access.tenantId,
            businessId: access.businessId,
            actorUserId: access.userId,
            action: "invoice.finalized",
            targetType: "invoice",
            targetPublicId: record.publicId,
            requestId,
          },
        });
      } else if (
        existingVersion &&
        (record.status === DocumentStatus.READY_TO_SEND || FINALIZED_STATUSES.has(record.status))
      ) {
        snapshot = existingVersion.snapshot as unknown as InvoiceSnapshot;
        versionPublicId = existingVersion.publicId;
        pdfStorageKey = existingVersion.pdfStorageKey;
        await transaction.auditEvent.create({
          data: {
            tenantId: access.tenantId,
            businessId: access.businessId,
            actorUserId: access.userId,
            action: "invoice.delivery_retried",
            targetType: "invoice",
            targetPublicId: record.publicId,
            requestId,
          },
        });
      } else {
        throw new BadRequestException({
          code: "INVOICE_NOT_SENDABLE",
          detail: "Mark the invoice ready before sending, or resend a failed delivery.",
        });
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

      return {
        context,
        delivery,
        pdfStorageKey,
        record,
        snapshot,
        versionPublicId,
      };
    });

    let attachment: Buffer;
    if (prepared.pdfStorageKey) {
      attachment = (await this.objectStore.get(prepared.pdfStorageKey)).body;
    } else {
      attachment = await this.pdf.renderInvoice(prepared.snapshot);
      const key = invoicePdfObjectKey({
        tenantId: access.tenantPublicId,
        businessId: access.businessPublicId,
        invoiceId: prepared.record.publicId,
        versionId: prepared.versionPublicId,
      });
      await this.objectStore.put({
        key,
        body: attachment,
        contentType: "application/pdf",
      });
      await this.database.withScope(access, async (transaction) => {
        await transaction.documentVersion.update({
          where: { publicId: prepared.versionPublicId },
          data: {
            pdfStorageKey: key,
            pdfContentType: "application/pdf",
            pdfByteSize: attachment.byteLength,
            pdfChecksumSha256: sha256Hex(attachment),
          },
        });
      });
    }

    let providerMessageId: string;
    try {
      providerMessageId = await this.mail.sendInvoice({
        attachment,
        body: input.message,
        businessName: prepared.context.name,
        filename: `${prepared.record.number}.pdf`,
        invoiceNumber: prepared.record.number,
        recipient: input.recipientEmail,
      });
    } catch (error) {
      await this.updateDelivery(
        access,
        prepared.delivery.id,
        DeliveryStatus.FAILED,
        undefined,
        this.safeFailureReason(error),
      );
      await this.database.withScope(access, async (transaction) => {
        if (
          prepared.record.status === DocumentStatus.READY_TO_SEND ||
          prepared.record.status === DocumentStatus.SEND_FAILED
        ) {
          await transaction.document.update({
            where: { id: prepared.record.id },
            data: { status: DocumentStatus.SEND_FAILED },
          });
        }
      });
      throw new ServiceUnavailableException({
        code: "DELIVERY_FAILED",
        detail:
          "The invoice could not be emailed. It was not marked sent — you can retry from the invoice.",
      });
    }

    const sentAt = new Date();
    await this.updateDelivery(
      access,
      prepared.delivery.id,
      DeliveryStatus.SENT,
      providerMessageId,
      undefined,
      sentAt,
    );

    const updated = await this.database.withScope(access, async (transaction) => {
      return (await transaction.document.update({
        where: { id: prepared.record.id },
        data: { status: DocumentStatus.SENT, sentAt },
        include: this.detailInclude(),
      })) as unknown as InvoiceRecord;
    });

    return {
      invoice: this.mapInvoice({
        ...updated,
        deliveries: [
          {
            publicId: prepared.delivery.publicId,
            status: DeliveryStatus.SENT,
            recipientEmail: input.recipientEmail,
            sentAt,
            failureReason: null,
          },
        ],
      }),
      delivery: {
        id: prepared.delivery.publicId,
        status: "SENT",
        recipientEmail: input.recipientEmail,
        sentAt: sentAt.toISOString(),
      },
    };
  }

  /**
   * Generate the ZATCA (Saudi e-invoicing) UBL 2.1 tax-invoice XML for a finalized invoice.
   *
   * Fail-closed on two axes: the invoice must be finalized (a `DocumentVersion` snapshot exists), and
   * the selling business must be in Saudi Arabia. Both are rejected with a 400 rather than producing
   * a non-compliant document. The XML is built purely from the immutable finalized snapshot.
   */
  async zatcaXml(
    userPublicId: string,
    businessPublicId: string,
    invoicePublicId: string,
  ): Promise<{ filename: string; xml: string }> {
    const access = await this.authorize(userPublicId, businessPublicId, "export");
    const { record, snapshot, sellerCountryCode } = await this.loadZatcaSnapshot(
      access,
      invoicePublicId,
    );
    const xml = buildZatcaXmlFromSnapshot({
      snapshot,
      invoiceUuid: record.publicId,
      invoiceNumber: record.number,
      sellerCountryCode,
    });
    return { xml, filename: `${record.number}-zatca.xml` };
  }

  /**
   * Generate the ZATCA Phase 1 QR payload (base64 TLV with the five mandatory tags) for a finalized
   * SA invoice. Same fail-closed gate as {@link zatcaXml}.
   */
  async zatcaQr(
    userPublicId: string,
    businessPublicId: string,
    invoicePublicId: string,
  ): Promise<{ base64: string; number: string }> {
    const access = await this.authorize(userPublicId, businessPublicId, "export");
    const { record, snapshot, sellerCountryCode } = await this.loadZatcaSnapshot(
      access,
      invoicePublicId,
    );
    const base64 = buildZatcaQrFromSnapshot({
      snapshot,
      invoiceUuid: record.publicId,
      invoiceNumber: record.number,
      sellerCountryCode,
    });
    return { base64, number: record.number };
  }

  /**
   * Load the finalized snapshot for ZATCA generation and enforce the fail-closed gate. Reuses the
   * stored `DocumentVersion` snapshot captured at finalization; a draft or ready-to-send invoice has
   * no such version and is refused.
   */
  private async loadZatcaSnapshot(
    access: BusinessAccessContext,
    invoicePublicId: string,
  ): Promise<{ record: InvoiceRecord; sellerCountryCode: string; snapshot: InvoiceSnapshot }> {
    return this.database.withScope(access, async (transaction) => {
      const record = await this.findRecordInTransaction(transaction, access, invoicePublicId);
      if (!FINALIZED_STATUSES.has(record.status)) {
        throw new BadRequestException({
          code: "INVOICE_NOT_FINALIZED",
          detail: "A ZATCA e-invoice can only be generated for a finalized (sent) invoice.",
        });
      }
      const version = await transaction.documentVersion.findFirst({
        where: {
          businessId: access.businessId,
          documentId: record.id,
          version: record.version,
        },
        select: { snapshot: true },
      });
      if (!version) {
        throw new BadRequestException({
          code: "INVOICE_NOT_FINALIZED",
          detail: "This invoice has no finalized snapshot yet.",
        });
      }
      const snapshot = version.snapshot as unknown as InvoiceSnapshot;

      const business = (await transaction.business.findUniqueOrThrow({
        where: { id: access.businessId },
        select: { countryCode: true },
      })) as { countryCode: string };
      // Prefer the snapshot's own country (immutable record of what was issued); fall back to the
      // live business country for snapshots captured before ZATCA support carried it.
      const sellerCountryCode = (snapshot.business.countryCode ?? business.countryCode)
        .trim()
        .toUpperCase();
      if (!isZatcaCountry(sellerCountryCode)) {
        throw new BadRequestException({
          code: "ZATCA_COUNTRY_UNSUPPORTED",
          detail: "ZATCA e-invoicing is only available for businesses registered in Saudi Arabia.",
        });
      }

      return { record, snapshot, sellerCountryCode };
    });
  }

  private async authorize(
    userPublicId: string,
    businessPublicId: string,
    action: AuthorizationAction,
  ): Promise<BusinessAccessContext> {
    const access = await this.businessAccess.resolve(userPublicId, businessPublicId);
    await this.businessAccess.assertAllowed(access, "invoices", action);
    return access;
  }

  private detailInclude() {
    return {
      customer: true,
      lines: { orderBy: { position: "asc" as const } },
      sourceQuotation: { select: { publicId: true, number: true } },
      linkedPurchaseOrder: { select: { publicId: true, poNumber: true } },
    };
  }

  private async findRecord(
    access: BusinessAccessContext,
    invoicePublicId: string,
  ): Promise<InvoiceRecord> {
    return this.database.withScope(access, (transaction) =>
      this.findRecordInTransaction(transaction, access, invoicePublicId),
    );
  }

  private async findRecordInTransaction(
    transaction: Prisma.TransactionClient,
    access: BusinessAccessContext,
    invoicePublicId: string,
  ): Promise<InvoiceRecord> {
    const record = await transaction.document.findFirst({
      where: {
        businessId: access.businessId,
        publicId: invoicePublicId,
        type: DocumentType.INVOICE,
      },
      include: this.detailInclude(),
    });
    if (!record) {
      throw new NotFoundException("We could not find that invoice.");
    }
    const latestDelivery = await transaction.documentDelivery.findFirst({
      where: {
        businessId: access.businessId,
        documentId: record.id,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        publicId: true,
        status: true,
        recipientEmail: true,
        sentAt: true,
        failureReason: true,
      },
    });
    return {
      ...(record as unknown as InvoiceRecord),
      deliveries: latestDelivery ? [latestDelivery] : [],
    };
  }

  private async loadSnapshot(
    access: BusinessAccessContext,
    invoicePublicId: string,
  ): Promise<{
    pdfStorageKey: string | null;
    record: InvoiceRecord;
    snapshot: InvoiceSnapshot;
  }> {
    return this.database.withScope(access, async (transaction) => {
      const record = await this.findRecordInTransaction(transaction, access, invoicePublicId);
      if (FINALIZED_STATUSES.has(record.status) || record.status === DocumentStatus.ARCHIVED) {
        const version = await transaction.documentVersion.findFirst({
          where: {
            businessId: access.businessId,
            documentId: record.id,
            version: record.version,
          },
          select: { snapshot: true, pdfStorageKey: true },
        });
        if (version) {
          return {
            record,
            snapshot: version.snapshot as unknown as InvoiceSnapshot,
            pdfStorageKey: version.pdfStorageKey,
          };
        }
      }
      const context = await this.loadSnapshotContext(transaction, access);
      return {
        record,
        snapshot: this.buildSnapshot(record, context),
        pdfStorageKey: null,
      };
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

  private buildSnapshot(record: InvoiceRecord, context: SnapshotContext): InvoiceSnapshot {
    return {
      business: {
        name: context.name,
        legalName: context.legalName,
        email: context.email,
        phone: context.phone,
        address: this.address(context),
        countryCode: context.countryCode,
        taxName: context.taxProfile.name,
        taxRegistrationNumber: context.taxProfile.registrationNumber,
      },
      customer: {
        name: record.customer.name,
        email: record.customer.email,
        phone: record.customer.phone,
        address: this.address(record.customer),
        countryCode: record.customer.countryCode,
      },
      number: record.number,
      issueDate: this.dateOnly(record.issueDate),
      dueDate: this.dateOnly(record.dueDate!),
      poNumber: record.poNumberSnapshot,
      projectReference: record.projectReference,
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

  private mapInvoice(record: InvoiceRecord): Invoice {
    if (!record.sourceQuotation || !record.dueDate) {
      throw new Error("Invoice is missing required source quotation or due date.");
    }
    const latest = record.deliveries?.[0];
    return {
      id: record.publicId,
      number: record.number,
      status: record.status as InvoiceStatus,
      issueDate: this.dateOnly(record.issueDate),
      dueDate: this.dateOnly(record.dueDate),
      validUntil: this.dateOnly(record.validUntil),
      currencyCode: record.currencyCode,
      currencyScale: record.currencyScale,
      subtotalMinor: record.subtotalMinor.toString(),
      taxMinor: record.taxMinor.toString(),
      totalMinor: record.totalMinor.toString(),
      notes: record.notes,
      poNumber: record.poNumberSnapshot,
      projectReference: record.projectReference,
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
      sourceQuotation: {
        id: record.sourceQuotation.publicId,
        number: record.sourceQuotation.number,
      },
      purchaseOrder: record.linkedPurchaseOrder
        ? {
            id: record.linkedPurchaseOrder.publicId,
            poNumber: record.linkedPurchaseOrder.poNumber,
          }
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
      latestDelivery: latest
        ? {
            id: latest.publicId,
            status: latest.status,
            recipientEmail: latest.recipientEmail,
            sentAt: latest.sentAt?.toISOString() ?? null,
            failureReason: latest.failureReason,
          }
        : null,
      sentAt: record.sentAt?.toISOString() ?? null,
      archivedAt: record.archivedAt?.toISOString() ?? null,
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
