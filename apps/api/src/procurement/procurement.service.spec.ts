import { BadRequestException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { type CreateSupplierPoRequest } from "@bizo/contracts/supplier-pos";
import {
  type CreateSupplierBillRequest,
  type CreateGrnRequest,
} from "@bizo/contracts/supplier-bills";
import { DocumentStatus, DocumentType } from "@bizo/database";

import { type DatabaseService } from "../database/database.service.js";
import { type BusinessAccessService } from "../security/business-access.service.js";
import { ProcurementService } from "./procurement.service.js";

const supplierRecord = {
  id: 10n,
  publicId: "sup-001",
  name: "Acme Supplies",
  email: "acme@example.test",
  phone: "+1234567890",
};

const businessRecord = {
  id: 1n,
  baseCurrency: "SAR",
  timeZone: "Asia/Riyadh",
  settings: {
    currencyScale: 2,
  },
};

const supplierPoRecord = (overrides: Record<string, unknown> = {}) => ({
  id: 200n,
  publicId: "spo-001",
  number: "PO-0001",
  status: DocumentStatus.DRAFT,
  type: DocumentType.SUPPLIER_PURCHASE_ORDER,
  issueDate: new Date("2026-08-01T00:00:00.000Z"),
  expectedReceiveDate: new Date("2026-08-15T00:00:00.000Z"),
  currencyCode: "SAR",
  currencyScale: 2,
  subtotalMinor: { toString: () => "10000" },
  taxMinor: { toString: () => "1500" },
  totalMinor: { toString: () => "11500" },
  notes: "Urgent shipment",
  supplier: supplierRecord,
  lines: [
    {
      position: 1,
      description: "Raw Steel",
      quantity: { toString: () => "10" },
      receivedQuantity: { toString: () => "0" },
      unitPriceMinor: { toString: () => "1000" },
      taxRatePpm: 150000,
      subtotalMinor: { toString: () => "10000" },
      taxMinor: { toString: () => "1500" },
      totalMinor: { toString: () => "11500" },
    },
  ],
  createdAt: new Date("2026-08-01T00:00:00.000Z"),
  updatedAt: new Date("2026-08-01T00:00:00.000Z"),
  ...overrides,
});

describe("ProcurementService", () => {
  const access = {
    businessId: 1n,
    businessPublicId: "biz-001",
    membershipId: 2n,
    role: "OWNER" as const,
    tenantId: 3n,
    tenantPublicId: "tenant-001",
    userId: 4n,
    userPublicId: "user-001",
  };

  const buildDatabase = (
    options: {
      noSupplier?: boolean;
      noPo?: boolean;
      issuedPo?: boolean;
    } = {},
  ): DatabaseService => {
    const transaction = {
      business: {
        findUniqueOrThrow: vi.fn().mockResolvedValue(businessRecord),
      },
      businessSettings: {
        update: vi.fn().mockResolvedValue({
          purchaseOrderPrefix: "PO-",
          nextPurchaseOrderNumber: 2,
          numberPadWidth: 4,
        }),
      },
      supplier: {
        findFirst: vi.fn().mockImplementation(async () => {
          if (options.noSupplier) return null;
          return supplierRecord;
        }),
      },
      document: {
        create: vi.fn().mockImplementation(async (args: { data: Record<string, unknown> }) => {
          const type = args.data.type;
          if (type === DocumentType.GOODS_RECEIPT_NOTE) {
            return {
              id: 300n,
              publicId: "grn-001",
              number: "GRN-001",
              issueDate: new Date("2026-08-01T00:00:00.000Z"),
              notes: "Received goods",
              supplier: supplierRecord,
              lines: (args.data.lines as { create: Array<Record<string, unknown>> })?.create ?? [],
              createdAt: new Date("2026-08-01T00:00:00.000Z"),
              updatedAt: new Date("2026-08-01T00:00:00.000Z"),
            };
          }
          return {
            ...supplierPoRecord(),
            ...args.data,
            lines: [
              {
                position: 1,
                description: "Raw Steel",
                quantity: { toString: () => "10" },
                unitPriceMinor: { toString: () => "1000" },
                taxRatePpm: 150000,
                subtotalMinor: { toString: () => "10000" },
                taxMinor: { toString: () => "1500" },
                totalMinor: { toString: () => "11500" },
              },
            ],
          };
        }),
        findFirst: vi.fn().mockImplementation(async (_args: { where: Record<string, unknown> }) => {
          if (options.noPo) return null;
          if (options.issuedPo) {
            return supplierPoRecord({ status: DocumentStatus.SENT });
          }
          return supplierPoRecord();
        }),
        findMany: vi.fn().mockResolvedValue([supplierPoRecord()]),
        update: vi.fn().mockImplementation(async (args: { data: Record<string, unknown> }) => ({
          ...supplierPoRecord(),
          ...args.data,
        })),
      },
      documentSequence: {
        upsert: vi.fn().mockResolvedValue({ nextValue: 1 }),
      },
      auditEvent: { create: vi.fn().mockResolvedValue({}) },
    };

    return {
      withScope: vi
        .fn()
        .mockImplementation(async (_scope: unknown, work: (tx: unknown) => unknown) =>
          work(transaction),
        ),
    } as unknown as DatabaseService;
  };

  const buildAccessService = (): BusinessAccessService =>
    ({
      resolve: vi.fn().mockResolvedValue(access),
      assertAllowed: vi.fn().mockResolvedValue(undefined),
    }) as unknown as BusinessAccessService;

  it("creates a supplier PO with lines and calculated totals", async () => {
    const service = new ProcurementService(buildDatabase(), buildAccessService());
    const input: CreateSupplierPoRequest = {
      supplierId: "sup-001",
      issueDate: "2026-08-01",
      expectedReceiveDate: "2026-08-15",
      notes: "Urgent shipment",
      lines: [
        {
          description: "Raw Steel",
          quantity: "10",
          unitPrice: "10",
          taxRatePercent: "15",
        },
      ],
    };

    const result = await service.createSupplierPo("user-001", "biz-001", input, "req-001");
    expect(result.id).toBe("spo-001");
    expect(result.supplier.id).toBe("sup-001");
    expect(result.status).toBe("DRAFT");
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]?.description).toBe("Raw Steel");
  });

  it("throws NotFoundException when supplier is not found on PO creation", async () => {
    const service = new ProcurementService(
      buildDatabase({ noSupplier: true }),
      buildAccessService(),
    );
    const input: CreateSupplierPoRequest = {
      supplierId: "sup-missing",
      lines: [{ description: "Steel", quantity: "1", unitPrice: "10", taxRatePercent: "0" }],
    };

    await expect(
      service.createSupplierPo("user-001", "biz-001", input, "req-002"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("lists supplier POs", async () => {
    const service = new ProcurementService(buildDatabase(), buildAccessService());
    const results = await service.listSupplierPos("user-001", "biz-001");
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe("spo-001");
  });

  it("retrieves a supplier PO by publicId", async () => {
    const service = new ProcurementService(buildDatabase(), buildAccessService());
    const result = await service.getSupplierPo("user-001", "biz-001", "spo-001");
    expect(result.id).toBe("spo-001");
  });

  it("issues a draft supplier PO", async () => {
    const service = new ProcurementService(buildDatabase(), buildAccessService());
    const result = await service.issueSupplierPo("user-001", "biz-001", "spo-001", "req-003");
    expect(result.status).toBe("ISSUED");
  });

  it("rejects issuing a non-draft supplier PO", async () => {
    const service = new ProcurementService(buildDatabase({ issuedPo: true }), buildAccessService());
    await expect(
      service.issueSupplierPo("user-001", "biz-001", "spo-001", "req-004"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("creates a supplier bill matched against PO", async () => {
    const service = new ProcurementService(buildDatabase(), buildAccessService());
    const input: CreateSupplierBillRequest = {
      supplierId: "sup-001",
      supplierPoId: "spo-001",
      billNumber: "INV-9999",
      billDate: "2026-08-01",
      lines: [
        {
          description: "Raw Steel",
          quantity: "10",
          unitPrice: "10",
          taxRatePercent: "15",
        },
      ],
    };

    const result = await service.createSupplierBill("user-001", "biz-001", input, "req-005");
    expect(result.id).toBe("spo-001");
    expect(result.matchStatus).toBe("MATCHED");
    expect(result.supplierPo?.id).toBe("spo-001");
  });

  it("creates a supplier bill with variance when prices mismatch", async () => {
    const service = new ProcurementService(buildDatabase(), buildAccessService());
    const input: CreateSupplierBillRequest = {
      supplierId: "sup-001",
      supplierPoId: "spo-001",
      billNumber: "INV-9999",
      billDate: "2026-08-01",
      lines: [
        {
          description: "Raw Steel",
          quantity: "10",
          unitPrice: "20", // 100% variance vs 10 in PO
          taxRatePercent: "15",
        },
      ],
    };

    const result = await service.createSupplierBill("user-001", "biz-001", input, "req-006");
    expect(result.matchStatus).toBe("VARIANCE");
  });

  it("creates a GRN with numbered positions", async () => {
    const service = new ProcurementService(buildDatabase(), buildAccessService());
    const input: CreateGrnRequest = {
      supplierId: "sup-001",
      receiveDate: "2026-08-01",
      notes: "Received shipment",
      lines: [
        { description: "Item 1", quantity: "5" },
        { description: "Item 2", quantity: "15" },
      ],
    };

    const result = await service.createGrn("user-001", "biz-001", input, "req-007");
    expect(result.id).toBe("grn-001");
    expect(result.status).toBe("RECEIVED");
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0]?.position).toBe(1);
    expect(result.lines[1]?.position).toBe(2);
  });

  it("lists GRNs", async () => {
    const service = new ProcurementService(buildDatabase(), buildAccessService());
    const results = await service.listGrns("user-001", "biz-001");
    expect(results).toHaveLength(1);
  });
});
