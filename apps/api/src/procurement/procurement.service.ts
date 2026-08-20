import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import { type CreateSupplierPoRequest, type SupplierPo } from "@bizo/contracts/supplier-pos";
import {
  type CreateSupplierBillRequest,
  type CreateGrnRequest,
  type SupplierBill,
  type GoodsReceiptNote,
} from "@bizo/contracts/supplier-bills";
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

interface SupplierPoLineRecord {
  description: string;
  position: number;
  quantity: DecimalLike;
  receivedQuantity: DecimalLike;
  subtotalMinor: DecimalLike;
  taxMinor: DecimalLike;
  taxRatePpm: number;
  totalMinor: DecimalLike;
  unitPriceMinor: DecimalLike;
}

interface SupplierPoRecord {
  createdAt: Date;
  currencyCode: string;
  currencyScale: number;
  expectedReceiveDate: Date | null;
  id: bigint;
  issueDate: Date;
  lines: SupplierPoLineRecord[];
  notes: string | null;
  number: string;
  publicId: string;
  status: DocumentStatus;
  subtotalMinor: DecimalLike;
  supplier: { email: string | null; name: string; phone: string | null; publicId: string };
  taxMinor: DecimalLike;
  totalMinor: DecimalLike;
  updatedAt: Date;
}

@Injectable()
export class ProcurementService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(BusinessAccessService) private readonly businessAccess: BusinessAccessService,
  ) {}

  async createSupplierPo(
    userPublicId: string,
    businessPublicId: string,
    input: CreateSupplierPoRequest,
    requestId: string,
  ): Promise<SupplierPo> {
    const access = await this.authorize(userPublicId, businessPublicId, "create");

    return this.database.withScope(access, async (transaction) => {
      const business = await transaction.business.findUniqueOrThrow({
        where: { id: access.businessId },
        include: { settings: true },
      });
      const settings = business.settings;
      if (!settings) throw new Error("Business settings are incomplete.");

      const supplier = await transaction.supplier.findFirst({
        where: { businessId: access.businessId, publicId: input.supplierId },
      });
      if (!supplier) throw new NotFoundException("We could not find that supplier.");

      const {
        lines: calculatedLines,
        subtotalMinor,
        taxMinor,
        totalMinor,
      } = calculateDocumentTotals(input.lines, settings.currencyScale);

      const allocated = await allocateDocumentNumber(
        transaction,
        access.businessId,
        "PURCHASE_ORDER",
      );
      const issueDate = input.issueDate ?? this.localDate(business.timeZone);
      const expectedReceiveDate = input.expectedReceiveDate
        ? new Date(`${input.expectedReceiveDate}T00:00:00.000Z`)
        : null;

      const document = (await transaction.document.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          supplierId: supplier.id,
          type: DocumentType.SUPPLIER_PURCHASE_ORDER,
          status: DocumentStatus.DRAFT,
          number: allocated.number,
          issueDate: this.toDatabaseDate(issueDate),
          expectedReceiveDate,
          currencyCode: business.baseCurrency,
          currencyScale: settings.currencyScale,
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
        include: this.supplierPoDetailInclude(),
      })) as unknown as SupplierPoRecord;

      await transaction.auditEvent.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          actorUserId: access.userId,
          action: "supplier_po.created",
          targetType: "supplier_po",
          targetPublicId: document.publicId,
          requestId,
        },
      });

      return this.mapSupplierPo(document);
    });
  }

  async listSupplierPos(userPublicId: string, businessPublicId: string): Promise<SupplierPo[]> {
    const access = await this.authorize(userPublicId, businessPublicId, "read");
    return this.database.withScope(access, async (transaction) => {
      const records = (await transaction.document.findMany({
        where: { businessId: access.businessId, type: DocumentType.SUPPLIER_PURCHASE_ORDER },
        include: this.supplierPoDetailInclude(),
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 200,
      })) as unknown as SupplierPoRecord[];
      return records.map((record) => this.mapSupplierPo(record));
    });
  }

  async getSupplierPo(
    userPublicId: string,
    businessPublicId: string,
    poPublicId: string,
  ): Promise<SupplierPo> {
    const access = await this.authorize(userPublicId, businessPublicId, "read");
    return this.database.withScope(access, async (transaction) => {
      const record = await this.findSupplierPo(transaction, access, poPublicId);
      return this.mapSupplierPo(record);
    });
  }

  async issueSupplierPo(
    userPublicId: string,
    businessPublicId: string,
    poPublicId: string,
    requestId: string,
  ): Promise<SupplierPo> {
    const access = await this.authorize(userPublicId, businessPublicId, "update");
    return this.database.withScope(access, async (transaction) => {
      const existing = await this.findSupplierPo(transaction, access, poPublicId);
      if (existing.status !== DocumentStatus.DRAFT) {
        throw new BadRequestException("Only draft supplier POs can be issued.");
      }

      const updated = (await transaction.document.update({
        where: { id: existing.id },
        data: { status: DocumentStatus.SENT },
        include: this.supplierPoDetailInclude(),
      })) as unknown as SupplierPoRecord;

      await transaction.auditEvent.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          actorUserId: access.userId,
          action: "supplier_po.issued",
          targetType: "supplier_po",
          targetPublicId: updated.publicId,
          requestId,
        },
      });

      return this.mapSupplierPo(updated);
    });
  }

  async createSupplierBill(
    userPublicId: string,
    businessPublicId: string,
    input: CreateSupplierBillRequest,
    requestId: string,
  ): Promise<SupplierBill> {
    const access = await this.authorize(userPublicId, businessPublicId, "create");

    return this.database.withScope(access, async (transaction) => {
      const business = await transaction.business.findUniqueOrThrow({
        where: { id: access.businessId },
        include: { settings: true },
      });
      const settings = business.settings;
      if (!settings) throw new Error("Business settings are incomplete.");

      const supplier = await transaction.supplier.findFirst({
        where: { businessId: access.businessId, publicId: input.supplierId },
      });
      if (!supplier) throw new NotFoundException("We could not find that supplier.");

      let supplierPoPublicId: string | null = null;
      let matchStatus: "MATCHED" | "VARIANCE" | "NO_PO" = "NO_PO";

      if (input.supplierPoId) {
        const po = await transaction.document.findFirst({
          where: {
            businessId: access.businessId,
            publicId: input.supplierPoId,
            type: DocumentType.SUPPLIER_PURCHASE_ORDER,
          },
          include: { lines: true },
        });
        if (!po) throw new NotFoundException("We could not find that supplier PO.");

        supplierPoPublicId = po.publicId;
        matchStatus = this.evaluateMatch(input, po.lines);
      }

      const {
        lines: calculatedLines,
        subtotalMinor,
        taxMinor,
        totalMinor,
      } = calculateDocumentTotals(input.lines, settings.currencyScale);

      const document = (await transaction.document.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          supplierId: supplier.id,
          type: DocumentType.SUPPLIER_BILL,
          status: DocumentStatus.DRAFT,
          number: input.billNumber,
          issueDate: this.toDatabaseDate(input.billDate),
          dueDate: input.dueDate ? this.toDatabaseDate(input.dueDate) : null,
          currencyCode: business.baseCurrency,
          currencyScale: settings.currencyScale,
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
        include: this.supplierBillDetailInclude(),
      })) as unknown as { publicId: string };

      await transaction.auditEvent.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          actorUserId: access.userId,
          action: "supplier_bill.created",
          targetType: "supplier_bill",
          targetPublicId: document.publicId,
          requestId,
        },
      });

      return this.mapSupplierBill(
        document as Parameters<typeof this.mapSupplierBill>[0],
        matchStatus,
        supplierPoPublicId,
      );
    });
  }

  async listSupplierBills(userPublicId: string, businessPublicId: string): Promise<SupplierBill[]> {
    const access = await this.authorize(userPublicId, businessPublicId, "read");
    return this.database.withScope(access, async (transaction) => {
      const records = (await transaction.document.findMany({
        where: { businessId: access.businessId, type: DocumentType.SUPPLIER_BILL },
        include: this.supplierBillDetailInclude(),
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 200,
      })) as unknown as Parameters<typeof this.mapSupplierBill>[0][];
      return records.map((record) => this.mapSupplierBill(record, "NO_PO", null));
    });
  }

  async createGrn(
    userPublicId: string,
    businessPublicId: string,
    input: CreateGrnRequest,
    requestId: string,
  ): Promise<GoodsReceiptNote> {
    const access = await this.authorize(userPublicId, businessPublicId, "create");

    return this.database.withScope(access, async (transaction) => {
      const business = await transaction.business.findUniqueOrThrow({
        where: { id: access.businessId },
        include: { settings: true },
      });
      const settings = business.settings;
      if (!settings) throw new Error("Business settings are incomplete.");

      const supplier = await transaction.supplier.findFirst({
        where: { businessId: access.businessId, publicId: input.supplierId },
      });
      if (!supplier) throw new NotFoundException("We could not find that supplier.");

      let supplierPoPublicId: string | null = null;
      if (input.supplierPoId) {
        const po = await transaction.document.findFirst({
          where: {
            businessId: access.businessId,
            publicId: input.supplierPoId,
            type: DocumentType.SUPPLIER_PURCHASE_ORDER,
          },
        });
        if (!po) throw new NotFoundException("We could not find that supplier PO.");
        supplierPoPublicId = po.publicId;
      }

      const receiveDate = input.receiveDate ?? this.localDate(business.timeZone);

      const document = (await transaction.document.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          supplierId: supplier.id,
          type: DocumentType.GOODS_RECEIPT_NOTE,
          status: DocumentStatus.DRAFT,
          number: `GRN-${Date.now().toString(36).toUpperCase()}`,
          issueDate: this.toDatabaseDate(receiveDate),
          currencyCode: business.baseCurrency,
          currencyScale: settings.currencyScale,
          subtotalMinor: "0",
          taxMinor: "0",
          totalMinor: "0",
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
        include: this.grnDetailInclude(),
      })) as unknown as Parameters<typeof this.mapGrn>[0];

      await transaction.auditEvent.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          actorUserId: access.userId,
          action: "grn.created",
          targetType: "grn",
          targetPublicId: document.publicId,
          requestId,
        },
      });

      return this.mapGrn(document, supplierPoPublicId);
    });
  }

  async listGrns(userPublicId: string, businessPublicId: string): Promise<GoodsReceiptNote[]> {
    const access = await this.authorize(userPublicId, businessPublicId, "read");
    return this.database.withScope(access, async (transaction) => {
      const records = (await transaction.document.findMany({
        where: { businessId: access.businessId, type: DocumentType.GOODS_RECEIPT_NOTE },
        include: this.grnDetailInclude(),
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 200,
      })) as unknown as Parameters<typeof this.mapGrn>[0][];
      return records.map((record) => this.mapGrn(record, null));
    });
  }

  private evaluateMatch(
    input: CreateSupplierBillRequest,
    poLines: Array<{
      description?: string;
      quantity: { toString: () => string };
      unitPriceMinor: { toString: () => string };
    }>,
  ): "MATCHED" | "VARIANCE" {
    const varianceThreshold = 0.02;

    for (const line of input.lines) {
      const poLine = poLines.find((po) => po.description === line.description);
      if (!poLine) return "VARIANCE";

      const billQty = Number(line.quantity);
      const poQty = Number(poLine.quantity.toString());
      const billPrice = Number(line.unitPrice);
      const poPrice = Number(poLine.unitPriceMinor.toString()) / 100;

      if (poQty > 0 && Math.abs(billQty - poQty) / poQty > varianceThreshold) return "VARIANCE";
      if (poPrice > 0 && Math.abs(billPrice - poPrice) / poPrice > varianceThreshold)
        return "VARIANCE";
    }

    return "MATCHED";
  }

  private async authorize(
    userPublicId: string,
    businessPublicId: string,
    action: AuthorizationAction,
  ): Promise<BusinessAccessContext> {
    const access = await this.businessAccess.resolve(userPublicId, businessPublicId);
    await this.businessAccess.assertAllowed(access, "purchase_orders", action);
    return access;
  }

  private supplierPoDetailInclude() {
    return {
      supplier: true,
      lines: { orderBy: { position: "asc" as const } },
    } satisfies Prisma.DocumentInclude;
  }

  private supplierBillDetailInclude() {
    return {
      supplier: true,
      lines: { orderBy: { position: "asc" as const } },
    } satisfies Prisma.DocumentInclude;
  }

  private grnDetailInclude() {
    return {
      supplier: true,
      lines: { orderBy: { position: "asc" as const } },
    } satisfies Prisma.DocumentInclude;
  }

  private async findSupplierPo(
    transaction: Prisma.TransactionClient,
    access: BusinessAccessContext,
    poPublicId: string,
  ): Promise<SupplierPoRecord> {
    const record = (await transaction.document.findFirst({
      where: {
        businessId: access.businessId,
        publicId: poPublicId,
        type: DocumentType.SUPPLIER_PURCHASE_ORDER,
      },
      include: this.supplierPoDetailInclude(),
    })) as unknown as SupplierPoRecord | null;
    if (!record) throw new NotFoundException("We could not find that supplier PO.");
    return record;
  }

  private mapSupplierPo(record: SupplierPoRecord): SupplierPo {
    return {
      id: record.publicId,
      number: record.number,
      status: this.mapPoStatus(record.status),
      issueDate: this.dateOnly(record.issueDate),
      expectedReceiveDate: record.expectedReceiveDate
        ? this.dateOnly(record.expectedReceiveDate)
        : null,
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
      lines: record.lines.map((line) => ({
        position: line.position,
        description: line.description,
        quantity: line.quantity.toString(),
        receivedQuantity: "0",
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

  private mapSupplierBill(
    record: {
      publicId: string;
      number: string;
      status: DocumentStatus;
      issueDate: Date;
      dueDate: Date | null;
      currencyCode: string;
      currencyScale: number;
      subtotalMinor: { toString: () => string };
      taxMinor: { toString: () => string };
      totalMinor: { toString: () => string };
      notes: string | null;
      supplier: { publicId: string; name: string; email: string | null; phone: string | null };
      lines: Array<{
        position: number;
        description: string;
        quantity: { toString: () => string };
        unitPriceMinor: { toString: () => string };
        taxRatePpm: number;
        subtotalMinor: { toString: () => string };
        taxMinor: { toString: () => string };
        totalMinor: { toString: () => string };
      }>;
      createdAt: Date;
      updatedAt: Date;
    },
    matchStatus: string,
    supplierPoPublicId: string | null,
  ): SupplierBill {
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
      supplierPo: supplierPoPublicId ? { id: supplierPoPublicId, number: "" } : null,
      matchStatus: matchStatus as "MATCHED" | "VARIANCE" | "NO_PO",
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

  private mapGrn(
    record: {
      publicId: string;
      number: string;
      issueDate: Date | null;
      notes: string | null;
      supplier: { publicId: string; name: string };
      lines: Array<{ position: number; description: string; quantity: { toString: () => string } }>;
      createdAt: Date;
      updatedAt: Date;
    },
    supplierPoPublicId: string | null,
  ): GoodsReceiptNote {
    return {
      id: record.publicId,
      number: record.number,
      status: "RECEIVED",
      receiveDate: record.issueDate ? this.dateOnly(record.issueDate) : null,
      notes: record.notes,
      supplier: { id: record.supplier.publicId, name: record.supplier.name },
      supplierPo: supplierPoPublicId ? { id: supplierPoPublicId, number: "" } : null,
      lines: record.lines.map((line) => ({
        position: line.position,
        description: line.description,
        quantity: line.quantity.toString(),
      })),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private mapPoStatus(status: DocumentStatus): SupplierPo["status"] {
    switch (status) {
      case DocumentStatus.DRAFT:
        return "DRAFT";
      case DocumentStatus.SENT:
        return "ISSUED";
      case DocumentStatus.ARCHIVED:
        return "CANCELLED";
      default:
        return "RECEIVED";
    }
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
}
