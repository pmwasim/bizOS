import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  StreamableFile,
  UnsupportedMediaTypeException,
} from "@nestjs/common";

import {
  bestReadiness,
  canCreateInvoiceFromQuotation,
  type CreatePurchaseOrderRequest,
  derivePurchaseOrderReadiness,
  type PurchaseOrder,
  type Readiness,
  type StoredObjectSummary,
  type UpdateApprovalStatusRequest,
  type UpdatePurchaseOrderRequest,
} from "@bizo/contracts/purchase-orders";
import { type SupplierBill } from "@bizo/contracts/supplier-bills";
import {
  DocumentStatus,
  DocumentType,
  InvoiceApprovalStatus,
  type Prisma,
  PurchaseOrderStatus,
  StoredObjectKind,
} from "@bizo/database";
import {
  detectAllowedContentType,
  MAX_STORED_OBJECT_BYTES,
  purchaseOrderObjectKey,
  sanitizeUploadFilename,
  sha256Hex,
  type ObjectStore,
} from "@bizo/storage";

import { ConfigurationService } from "../configuration/configuration.service.js";
import { DatabaseService } from "../database/database.service.js";
import { allocateDocumentNumber } from "../numbering/numbering.js";
import {
  type AuthorizationAction,
  type AuthorizationObject,
  type BusinessAccessContext,
  BusinessAccessService,
} from "../security/business-access.service.js";
import { OBJECT_STORE } from "../storage/object-store.token.js";

type PurchaseOrderDetail = {
  publicId: string;
  status: PurchaseOrderStatus;
  poNumber: string;
  poDate: Date | null;
  projectReference: string | null;
  amountMinor: Prisma.Decimal | null;
  currencyCode: string | null;
  currencyScale: number | null;
  notes: string | null;
  approvalStatus: InvoiceApprovalStatus;
  approvalChangedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  customerId: bigint;
  quotationId: bigint | null;
  customer: { publicId: string; name: string };
  quotation: { publicId: string; number: string; type: DocumentType } | null;
  storedObjects: Array<{
    publicId: string;
    kind: StoredObjectKind;
    originalFilename: string;
    contentType: string;
    byteSize: number;
    checksumSha256: string;
    createdAt: Date;
  }>;
};

type SupplierBillRecord = {
  publicId: string;
  number: string;
  status: DocumentStatus;
  issueDate: Date;
  dueDate: Date | null;
  currencyCode: string;
  currencyScale: number;
  subtotalMinor: Prisma.Decimal;
  taxMinor: Prisma.Decimal;
  totalMinor: Prisma.Decimal;
  notes: string | null;
  supplier: { publicId: string; name: string; email: string | null; phone: string | null };
  lines: Array<{
    position: number;
    description: string;
    quantity: Prisma.Decimal;
    unitPriceMinor: Prisma.Decimal;
    taxRatePpm: number;
    subtotalMinor: Prisma.Decimal;
    taxMinor: Prisma.Decimal;
    totalMinor: Prisma.Decimal;
  }>;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class PurchaseOrdersService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(BusinessAccessService) private readonly businessAccess: BusinessAccessService,
    @Inject(OBJECT_STORE) private readonly objectStore: ObjectStore,
    @Inject(ConfigurationService) private readonly configuration: ConfigurationService,
  ) {}

  async create(
    userPublicId: string,
    businessPublicId: string,
    input: CreatePurchaseOrderRequest,
    requestId: string,
  ): Promise<PurchaseOrder> {
    const access = await this.authorize(
      userPublicId,
      businessPublicId,
      "purchase_orders",
      "create",
    );
    return this.database.withScope(access, async (transaction) => {
      const customer = await transaction.customer.findFirst({
        where: { businessId: access.businessId, publicId: input.customerId },
      });
      if (!customer) {
        throw new NotFoundException("We could not find that customer.");
      }

      const quotation = input.quotationId
        ? await this.requireQuotationForCustomer(
            transaction,
            access,
            input.quotationId,
            customer.id,
          )
        : null;

      try {
        const created = await transaction.purchaseOrder.create({
          data: {
            tenantId: access.tenantId,
            businessId: access.businessId,
            customerId: customer.id,
            quotationId: quotation?.id ?? null,
            poNumber: input.poNumber,
            poDate: input.poDate ? new Date(`${input.poDate}T00:00:00.000Z`) : null,
            projectReference: input.projectReference,
            amountMinor: input.amountMinor,
            currencyCode: input.currencyCode,
            currencyScale: input.currencyScale,
            notes: input.notes,
            createdByMembershipId: access.membershipId,
          },
          include: this.detailInclude(),
        });
        await transaction.auditEvent.create({
          data: {
            tenantId: access.tenantId,
            businessId: access.businessId,
            actorUserId: access.userId,
            action: "purchase_order.created",
            targetType: "purchase_order",
            targetPublicId: created.publicId,
            after: {
              poNumber: created.poNumber,
              customerId: customer.publicId,
              quotationId: quotation?.publicId ?? null,
            },
            requestId,
          },
        });
        return this.mapPurchaseOrder(created);
      } catch (error) {
        this.rethrowDuplicatePoNumber(error);
        throw error;
      }
    });
  }

  async list(userPublicId: string, businessPublicId: string): Promise<PurchaseOrder[]> {
    const access = await this.authorize(userPublicId, businessPublicId, "purchase_orders", "read");
    return this.database.withScope(access, async (transaction) => {
      const rows = (await transaction.purchaseOrder.findMany({
        where: { businessId: access.businessId, status: PurchaseOrderStatus.ACTIVE },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 200,
        include: this.detailInclude(),
      })) as PurchaseOrderDetail[];
      return rows.map((row) => this.mapPurchaseOrder(row));
    });
  }

  async listForQuotation(
    userPublicId: string,
    businessPublicId: string,
    quotationPublicId: string,
  ): Promise<{
    purchaseOrders: PurchaseOrder[];
    readiness: Readiness;
    customerPoRequired: boolean;
    canCreateInvoice: boolean;
  }> {
    const access = await this.authorize(userPublicId, businessPublicId, "purchase_orders", "read");
    const conversionPolicy = await this.configuration.getInvoiceConversionPolicy(
      userPublicId,
      businessPublicId,
    );
    return this.database.withScope(access, async (transaction) => {
      const quotation = await transaction.document.findFirst({
        where: {
          businessId: access.businessId,
          publicId: quotationPublicId,
          type: DocumentType.QUOTATION,
        },
      });
      if (!quotation) {
        throw new NotFoundException("We could not find that quotation.");
      }
      const rows = (await transaction.purchaseOrder.findMany({
        where: {
          businessId: access.businessId,
          quotationId: quotation.id,
          status: PurchaseOrderStatus.ACTIVE,
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: this.detailInclude(),
      })) as PurchaseOrderDetail[];
      const purchaseOrders = rows.map((row) => this.mapPurchaseOrder(row));
      const readiness = bestReadiness(
        purchaseOrders.map((item) => item.readiness),
        { customerPoRequired: conversionPolicy.customerPoRequired },
      );
      return {
        purchaseOrders,
        readiness,
        customerPoRequired: conversionPolicy.customerPoRequired,
        canCreateInvoice: canCreateInvoiceFromQuotation({
          customerPoRequired: conversionPolicy.customerPoRequired,
          quotationStatus: quotation.status,
          purchaseOrderReadiness: readiness,
        }),
      };
    });
  }

  async get(
    userPublicId: string,
    businessPublicId: string,
    purchaseOrderPublicId: string,
  ): Promise<PurchaseOrder> {
    const access = await this.authorize(userPublicId, businessPublicId, "purchase_orders", "read");
    return this.database.withScope(access, async (transaction) => {
      const row = await this.requirePurchaseOrder(transaction, access, purchaseOrderPublicId);
      return this.mapPurchaseOrder(row);
    });
  }

  async update(
    userPublicId: string,
    businessPublicId: string,
    purchaseOrderPublicId: string,
    input: UpdatePurchaseOrderRequest,
    requestId: string,
  ): Promise<PurchaseOrder> {
    const access = await this.authorize(
      userPublicId,
      businessPublicId,
      "purchase_orders",
      "update",
    );
    return this.database.withScope(access, async (transaction) => {
      const existing = await this.requirePurchaseOrder(transaction, access, purchaseOrderPublicId);
      if (existing.status === PurchaseOrderStatus.ARCHIVED) {
        throw new BadRequestException("Archived purchase orders cannot be edited.");
      }

      let quotationId = existing.quotationId;
      if (Object.hasOwn(input, "quotationId")) {
        if (input.quotationId === null) {
          quotationId = null;
        } else if (input.quotationId) {
          const quotation = await this.requireQuotationForCustomer(
            transaction,
            access,
            input.quotationId,
            existing.customerId,
          );
          quotationId = quotation.id;
        }
      }

      try {
        const updated = await transaction.purchaseOrder.update({
          where: { id: existing.id },
          data: {
            quotationId,
            poNumber: input.poNumber ?? undefined,
            poDate:
              input.poDate === undefined
                ? undefined
                : input.poDate
                  ? new Date(`${input.poDate}T00:00:00.000Z`)
                  : null,
            projectReference:
              input.projectReference === undefined ? undefined : input.projectReference,
            amountMinor: input.amountMinor === undefined ? undefined : input.amountMinor,
            currencyCode: input.currencyCode === undefined ? undefined : input.currencyCode,
            currencyScale: input.currencyScale === undefined ? undefined : input.currencyScale,
            notes: input.notes === undefined ? undefined : input.notes,
          },
          include: this.detailInclude(),
        });
        await transaction.auditEvent.create({
          data: {
            tenantId: access.tenantId,
            businessId: access.businessId,
            actorUserId: access.userId,
            action: "purchase_order.updated",
            targetType: "purchase_order",
            targetPublicId: updated.publicId,
            before: {
              poNumber: existing.poNumber,
              quotationId: existing.quotation?.publicId ?? null,
            },
            after: { poNumber: updated.poNumber, quotationId: updated.quotation?.publicId ?? null },
            requestId,
          },
        });
        return this.mapPurchaseOrder(updated);
      } catch (error) {
        this.rethrowDuplicatePoNumber(error);
        throw error;
      }
    });
  }

  async archive(
    userPublicId: string,
    businessPublicId: string,
    purchaseOrderPublicId: string,
    requestId: string,
  ): Promise<PurchaseOrder> {
    const access = await this.authorize(
      userPublicId,
      businessPublicId,
      "purchase_orders",
      "archive",
    );
    return this.database.withScope(access, async (transaction) => {
      const existing = await this.requirePurchaseOrder(transaction, access, purchaseOrderPublicId);
      if (existing.status === PurchaseOrderStatus.ARCHIVED) {
        return this.mapPurchaseOrder(existing);
      }
      const archived = await transaction.purchaseOrder.update({
        where: { id: existing.id },
        data: {
          status: PurchaseOrderStatus.ARCHIVED,
          archivedAt: new Date(),
        },
        include: this.detailInclude(),
      });
      await transaction.auditEvent.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          actorUserId: access.userId,
          action: "purchase_order.archived",
          targetType: "purchase_order",
          targetPublicId: archived.publicId,
          before: { status: existing.status },
          after: { status: archived.status },
          requestId,
        },
      });
      return this.mapPurchaseOrder(archived);
    });
  }

  async updateApproval(
    userPublicId: string,
    businessPublicId: string,
    purchaseOrderPublicId: string,
    input: UpdateApprovalStatusRequest,
    requestId: string,
  ): Promise<PurchaseOrder> {
    const access = await this.authorize(userPublicId, businessPublicId, "approvals", "update");
    return this.database.withScope(access, async (transaction) => {
      const existing = await this.requirePurchaseOrder(transaction, access, purchaseOrderPublicId);
      if (existing.status === PurchaseOrderStatus.ARCHIVED) {
        throw new BadRequestException("Archived purchase orders cannot change approval.");
      }
      const previous = existing.approvalStatus;
      const next = input.approvalStatus as InvoiceApprovalStatus;
      const updated = await transaction.purchaseOrder.update({
        where: { id: existing.id },
        data: {
          approvalStatus: next,
          approvalChangedAt: new Date(),
          approvalChangedByUserId: access.userId,
        },
        include: this.detailInclude(),
      });
      await transaction.auditEvent.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          actorUserId: access.userId,
          action: "purchase_order.approval_changed",
          targetType: "purchase_order",
          targetPublicId: updated.publicId,
          before: { approvalStatus: previous },
          after: { approvalStatus: next },
          requestId,
        },
      });
      return this.mapPurchaseOrder(updated);
    });
  }

  async uploadFile(
    userPublicId: string,
    businessPublicId: string,
    purchaseOrderPublicId: string,
    kind: StoredObjectKind,
    file: { buffer: Buffer; mimetype: string; originalname: string; size: number },
    requestId: string,
  ): Promise<PurchaseOrder> {
    const object = kind === StoredObjectKind.APPROVAL_EVIDENCE ? "approvals" : "purchase_orders";
    const action = kind === StoredObjectKind.APPROVAL_EVIDENCE ? "upload_evidence" : "upload";
    const access = await this.authorize(
      userPublicId,
      businessPublicId,
      object,
      action as AuthorizationAction,
    );

    if (file.size > MAX_STORED_OBJECT_BYTES || file.buffer.byteLength > MAX_STORED_OBJECT_BYTES) {
      throw new PayloadTooLargeException("Files must be 10 MB or smaller.");
    }
    const contentType = detectAllowedContentType(file.buffer, file.mimetype);
    if (!contentType) {
      throw new UnsupportedMediaTypeException("Upload a PDF, JPEG, PNG, or WebP file.");
    }

    const accessCtx = access;
    const filePublicId = crypto.randomUUID();
    const safeFilename = sanitizeUploadFilename(file.originalname);
    const storageKey = purchaseOrderObjectKey({
      tenantId: accessCtx.tenantPublicId,
      businessId: accessCtx.businessPublicId,
      purchaseOrderId: purchaseOrderPublicId,
      fileId: filePublicId,
      kind: kind === StoredObjectKind.APPROVAL_EVIDENCE ? "approval-evidence" : "purchase-orders",
      safeFilename,
    });
    const checksum = sha256Hex(file.buffer);

    await this.objectStore.put({
      key: storageKey,
      body: file.buffer,
      contentType,
    });

    return this.database.withScope(accessCtx, async (transaction) => {
      const existing = await this.requirePurchaseOrder(
        transaction,
        accessCtx,
        purchaseOrderPublicId,
      );
      if (existing.status === PurchaseOrderStatus.ARCHIVED) {
        throw new BadRequestException("Archived purchase orders cannot accept uploads.");
      }

      await transaction.storedObject.updateMany({
        where: {
          purchaseOrderId: existing.id,
          kind,
          supersededAt: null,
        },
        data: { supersededAt: new Date() },
      });

      await transaction.storedObject.create({
        data: {
          publicId: filePublicId,
          tenantId: accessCtx.tenantId,
          businessId: accessCtx.businessId,
          purchaseOrderId: existing.id,
          kind,
          storageKey,
          originalFilename: safeFilename,
          contentType,
          byteSize: file.buffer.byteLength,
          checksumSha256: checksum,
          uploadedByUserId: accessCtx.userId,
        },
      });

      await transaction.auditEvent.create({
        data: {
          tenantId: accessCtx.tenantId,
          businessId: accessCtx.businessId,
          actorUserId: accessCtx.userId,
          action:
            kind === StoredObjectKind.APPROVAL_EVIDENCE
              ? "purchase_order.approval_evidence_uploaded"
              : "purchase_order.file_uploaded",
          targetType: "purchase_order",
          targetPublicId: existing.publicId,
          after: {
            fileId: filePublicId,
            kind,
            contentType,
            byteSize: file.buffer.byteLength,
            checksumSha256: checksum,
          },
          requestId,
        },
      });

      const refreshed = await this.requirePurchaseOrder(
        transaction,
        accessCtx,
        purchaseOrderPublicId,
      );
      return this.mapPurchaseOrder(refreshed);
    });
  }

  async downloadFile(
    userPublicId: string,
    businessPublicId: string,
    purchaseOrderPublicId: string,
    filePublicId: string,
  ): Promise<StreamableFile> {
    const access = await this.authorize(userPublicId, businessPublicId, "purchase_orders", "read");
    const meta = await this.database.withScope(access, async (transaction) => {
      const purchaseOrder = await transaction.purchaseOrder.findFirst({
        where: { businessId: access.businessId, publicId: purchaseOrderPublicId },
      });
      if (!purchaseOrder) {
        throw new NotFoundException("We could not find that purchase order.");
      }
      const stored = await transaction.storedObject.findFirst({
        where: {
          businessId: access.businessId,
          purchaseOrderId: purchaseOrder.id,
          publicId: filePublicId,
        },
      });
      if (!stored) {
        throw new NotFoundException("We could not find that file.");
      }
      return stored;
    });

    const object = await this.objectStore.get(meta.storageKey);
    return new StreamableFile(object.body, {
      type: meta.contentType,
      disposition: `attachment; filename="${meta.originalFilename.replaceAll('"', "")}"`,
    });
  }

  /**
   * One-click conversion of an APPROVED customer purchase order into a DRAFT {@link
   * DocumentType.SUPPLIER_BILL} document. Copies the purchase order's supplier, currency, and amount
   * onto a single bill line (customer POs carry a single amount rather than line items, so the whole
   * PO total becomes one zero-tax line), links the bill back to the source PO via
   * `purchaseOrderId`, and snapshots the PO number.
   *
   * Idempotent and race-safe, mirroring {@link
   * import("../documents/invoices.service.js").InvoicesService.convertFromQuotation}: a
   * transaction-scoped Postgres advisory lock keyed on the purchase order serializes concurrent
   * converts, and the dedup recheck on `(type = SUPPLIER_BILL, purchaseOrderId)` inside the same
   * transaction returns the existing bill instead of minting a duplicate.
   *
   * Readiness is fail-closed: only ACTIVE purchase orders whose `approvalStatus` is APPROVED convert,
   * and the PO must carry a supplier and an amount/currency before a bill can be derived from it.
   */
  async convertToBill(
    userPublicId: string,
    businessPublicId: string,
    purchaseOrderPublicId: string,
    requestId: string,
  ): Promise<SupplierBill> {
    const access = await this.authorize(
      userPublicId,
      businessPublicId,
      "purchase_orders",
      "create",
    );

    return this.database.withScope(access, async (transaction) => {
      // Serialize concurrent converts of the same purchase order. The transaction-scoped advisory
      // lock is released automatically on commit or rollback, so the dedup recheck below is
      // authoritative: a racing convert either has not yet inserted its bill, or already committed
      // one we will see. Keyed on the PO's public id (hashed to the bigint the advisory-lock API
      // expects).
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`po-convert:${purchaseOrderPublicId}`}))`;

      const purchaseOrder = (await transaction.purchaseOrder.findFirst({
        where: { businessId: access.businessId, publicId: purchaseOrderPublicId },
        include: { supplier: true },
      })) as {
        id: bigint;
        publicId: string;
        poNumber: string;
        projectReference: string | null;
        notes: string | null;
        status: PurchaseOrderStatus;
        approvalStatus: InvoiceApprovalStatus;
        amountMinor: Prisma.Decimal | null;
        currencyCode: string | null;
        currencyScale: number | null;
        supplier: {
          id: bigint;
          publicId: string;
          name: string;
          email: string | null;
          phone: string | null;
        } | null;
      } | null;
      if (!purchaseOrder) {
        throw new NotFoundException("We could not find that purchase order.");
      }

      const existing = (await transaction.document.findFirst({
        where: {
          businessId: access.businessId,
          type: DocumentType.SUPPLIER_BILL,
          purchaseOrderId: purchaseOrder.id,
        },
        include: this.supplierBillDetailInclude(),
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      })) as SupplierBillRecord | null;
      if (existing) {
        return this.mapConvertedBill(existing);
      }

      if (purchaseOrder.status === PurchaseOrderStatus.ARCHIVED) {
        throw new BadRequestException({
          code: "PURCHASE_ORDER_ARCHIVED",
          detail: "Archived purchase orders cannot be converted to a supplier bill.",
        });
      }
      if (purchaseOrder.approvalStatus !== InvoiceApprovalStatus.APPROVED) {
        throw new BadRequestException({
          code: "PURCHASE_ORDER_NOT_APPROVED",
          detail: "Only approved purchase orders can be converted to a supplier bill.",
        });
      }
      if (!purchaseOrder.supplier) {
        throw new BadRequestException({
          code: "PURCHASE_ORDER_NO_SUPPLIER",
          detail: "Add a supplier to this purchase order before converting it to a supplier bill.",
        });
      }
      if (
        purchaseOrder.amountMinor === null ||
        purchaseOrder.currencyCode === null ||
        purchaseOrder.currencyScale === null
      ) {
        throw new BadRequestException({
          code: "PURCHASE_ORDER_NO_AMOUNT",
          detail:
            "Record an amount and currency on this purchase order before converting it to a supplier bill.",
        });
      }

      const business = await transaction.business.findUniqueOrThrow({
        where: { id: access.businessId },
        select: { timeZone: true },
      });
      const allocated = await allocateDocumentNumber(
        transaction,
        access.businessId,
        "SUPPLIER_BILL",
      );

      const amountMinor = purchaseOrder.amountMinor.toFixed(0);
      const description = (
        purchaseOrder.projectReference
          ? `Purchase order ${purchaseOrder.poNumber} (${purchaseOrder.projectReference})`
          : `Purchase order ${purchaseOrder.poNumber}`
      ).slice(0, 500);
      const issueDate = this.toDatabaseDate(this.localDate(business.timeZone));

      const document = (await transaction.document.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          supplierId: purchaseOrder.supplier.id,
          type: DocumentType.SUPPLIER_BILL,
          status: DocumentStatus.DRAFT,
          number: allocated.number,
          issueDate,
          purchaseOrderId: purchaseOrder.id,
          poNumberSnapshot: purchaseOrder.poNumber,
          projectReference: purchaseOrder.projectReference,
          currencyCode: purchaseOrder.currencyCode,
          currencyScale: purchaseOrder.currencyScale,
          subtotalMinor: amountMinor,
          taxMinor: "0",
          totalMinor: amountMinor,
          notes: purchaseOrder.notes,
          createdByMembershipId: access.membershipId,
          lines: {
            create: [
              {
                position: 1,
                description,
                quantity: "1",
                unitPriceMinor: amountMinor,
                taxRatePpm: 0,
                subtotalMinor: amountMinor,
                taxMinor: "0",
                totalMinor: amountMinor,
              },
            ],
          },
        },
        include: this.supplierBillDetailInclude(),
      })) as SupplierBillRecord;

      await transaction.auditEvent.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          actorUserId: access.userId,
          action: "supplier_bill.created",
          targetType: "supplier_bill",
          targetPublicId: document.publicId,
          after: {
            sourcePurchaseOrderId: purchaseOrder.publicId,
            status: document.status,
          },
          requestId,
        },
      });

      return this.mapConvertedBill(document);
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

  private detailInclude() {
    return {
      customer: { select: { publicId: true, name: true } },
      quotation: { select: { publicId: true, number: true, type: true } },
      storedObjects: {
        where: { supersededAt: null },
        orderBy: { createdAt: "desc" as const },
      },
    };
  }

  private supplierBillDetailInclude() {
    return {
      supplier: true,
      lines: { orderBy: { position: "asc" as const } },
    } satisfies Prisma.DocumentInclude;
  }

  /**
   * Map a persisted SUPPLIER_BILL document to the {@link SupplierBill} contract. A bill derived from
   * a customer purchase order is never matched against a supplier PO document, so `supplierPo` is
   * always null and `matchStatus` is always "NO_PO".
   */
  private mapConvertedBill(record: SupplierBillRecord): SupplierBill {
    return {
      id: record.publicId,
      number: record.number,
      billNumber: record.number,
      status: this.mapBillStatus(record.status),
      billDate: this.dateOnly(record.issueDate),
      dueDate: record.dueDate ? this.dateOnly(record.dueDate) : null,
      currencyCode: record.currencyCode,
      currencyScale: record.currencyScale,
      subtotalMinor: record.subtotalMinor.toString(),
      taxMinor: record.taxMinor.toString(),
      totalMinor: record.totalMinor.toString(),
      notes: record.notes,
      supplier: {
        id: record.supplier.publicId,
        name: record.supplier.name,
        email: record.supplier.email,
        phone: record.supplier.phone,
      },
      supplierPo: null,
      matchStatus: "NO_PO",
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

  private mapBillStatus(status: DocumentStatus): SupplierBill["status"] {
    switch (status) {
      case DocumentStatus.DRAFT:
        return "DRAFT";
      case DocumentStatus.SENT:
        return "APPROVED";
      case DocumentStatus.ARCHIVED:
        return "CANCELLED";
      default:
        return "PAID";
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

  private async requirePurchaseOrder(
    transaction: Prisma.TransactionClient,
    access: BusinessAccessContext,
    purchaseOrderPublicId: string,
  ) {
    const row = await transaction.purchaseOrder.findFirst({
      where: { businessId: access.businessId, publicId: purchaseOrderPublicId },
      include: this.detailInclude(),
    });
    if (!row) {
      throw new NotFoundException("We could not find that purchase order.");
    }
    return row;
  }

  private async requireQuotationForCustomer(
    transaction: Prisma.TransactionClient,
    access: BusinessAccessContext,
    quotationPublicId: string,
    customerId: bigint,
  ) {
    const quotation = await transaction.document.findFirst({
      where: {
        businessId: access.businessId,
        publicId: quotationPublicId,
        type: DocumentType.QUOTATION,
      },
    });
    if (!quotation) {
      throw new NotFoundException("We could not find that quotation.");
    }
    if (quotation.customerId !== customerId) {
      throw new BadRequestException(
        "Link a quotation that belongs to the same customer as this purchase order.",
      );
    }
    return quotation;
  }

  private rethrowDuplicatePoNumber(error: unknown): void {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: unknown }).code === "P2002"
    ) {
      throw new ConflictException({
        title: "Purchase order number already used",
        detail: "This customer already has an active purchase order with that number.",
      });
    }
  }

  private mapStoredObject(row: {
    publicId: string;
    kind: StoredObjectKind;
    originalFilename: string;
    contentType: string;
    byteSize: number;
    checksumSha256: string;
    createdAt: Date;
  }): StoredObjectSummary {
    return {
      id: row.publicId,
      kind: row.kind,
      originalFilename: row.originalFilename,
      contentType: row.contentType,
      byteSize: row.byteSize,
      checksumSha256: row.checksumSha256,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private mapPurchaseOrder(row: PurchaseOrderDetail): PurchaseOrder {
    const poFile =
      row.storedObjects.find((item) => item.kind === StoredObjectKind.PURCHASE_ORDER) ?? null;
    const approvalEvidence =
      row.storedObjects.find((item) => item.kind === StoredObjectKind.APPROVAL_EVIDENCE) ?? null;
    const readiness = derivePurchaseOrderReadiness({
      status: row.status,
      approvalStatus: row.approvalStatus,
      hasPoFile: Boolean(poFile),
      hasApprovalEvidence: Boolean(approvalEvidence),
      quotationLinked: Boolean(row.quotation),
    });

    return {
      id: row.publicId,
      status: row.status,
      poNumber: row.poNumber,
      poDate: row.poDate ? row.poDate.toISOString().slice(0, 10) : null,
      projectReference: row.projectReference,
      amountMinor: row.amountMinor ? row.amountMinor.toFixed(0) : null,
      currencyCode: row.currencyCode,
      currencyScale: row.currencyScale,
      notes: row.notes,
      customer: { id: row.customer.publicId, name: row.customer.name },
      quotation: row.quotation
        ? { id: row.quotation.publicId, number: row.quotation.number }
        : null,
      approvalStatus: row.approvalStatus,
      approvalChangedAt: row.approvalChangedAt?.toISOString() ?? null,
      poFile: poFile ? this.mapStoredObject(poFile) : null,
      approvalEvidence: approvalEvidence ? this.mapStoredObject(approvalEvidence) : null,
      readiness,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
