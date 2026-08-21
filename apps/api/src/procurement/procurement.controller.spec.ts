import { describe, expect, it, vi } from "vitest";

import { type CreateSupplierPoRequest, type SupplierPo } from "@bizo/contracts/supplier-pos";
import {
  type CreateSupplierBillRequest,
  type CreateGrnRequest,
  type SupplierBill,
  type GoodsReceiptNote,
} from "@bizo/contracts/supplier-bills";

import { type AuthenticatedPrincipal } from "../security/principal.js";
import {
  SupplierPosController,
  SupplierBillsController,
  GrnsController,
} from "./procurement.controller.js";
import { type ProcurementService } from "./procurement.service.js";

const principal: AuthenticatedPrincipal = {
  userId: "user-001",
};

const supplierPoMock: SupplierPo = {
  id: "spo-001",
  number: "PO-0001",
  status: "DRAFT",
  issueDate: "2026-08-01",
  expectedReceiveDate: "2026-08-15",
  currencyCode: "SAR",
  currencyScale: 2,
  subtotalMinor: "10000",
  taxMinor: "1500",
  totalMinor: "11500",
  notes: null,
  supplier: {
    id: "sup-001",
    name: "Acme Supplies",
    email: null,
    phone: null,
  },
  lines: [],
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

const supplierBillMock: SupplierBill = {
  id: "bill-001",
  number: "BILL-001",
  billNumber: "INV-9999",
  status: "DRAFT",
  billDate: "2026-08-01",
  dueDate: null,
  currencyCode: "SAR",
  currencyScale: 2,
  subtotalMinor: "10000",
  taxMinor: "1500",
  totalMinor: "11500",
  notes: null,
  supplier: {
    id: "sup-001",
    name: "Acme Supplies",
    email: null,
    phone: null,
  },
  supplierPo: null,
  matchStatus: "NO_PO",
  lines: [],
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

const grnMock: GoodsReceiptNote = {
  id: "grn-001",
  number: "GRN-001",
  status: "RECEIVED",
  receiveDate: "2026-08-01",
  notes: null,
  supplier: { id: "sup-001", name: "Acme Supplies" },
  supplierPo: null,
  lines: [],
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

describe("Procurement Controllers", () => {
  const buildService = (): ProcurementService =>
    ({
      createSupplierPo: vi.fn().mockResolvedValue(supplierPoMock),
      listSupplierPos: vi.fn().mockResolvedValue([supplierPoMock]),
      getSupplierPo: vi.fn().mockResolvedValue(supplierPoMock),
      issueSupplierPo: vi.fn().mockResolvedValue({ ...supplierPoMock, status: "ISSUED" }),
      createSupplierBill: vi.fn().mockResolvedValue(supplierBillMock),
      listSupplierBills: vi.fn().mockResolvedValue([supplierBillMock]),
      createGrn: vi.fn().mockResolvedValue(grnMock),
      listGrns: vi.fn().mockResolvedValue([grnMock]),
    }) as unknown as ProcurementService;

  describe("SupplierPosController", () => {
    it("delegates create to ProcurementService", async () => {
      const service = buildService();
      const controller = new SupplierPosController(service);
      const input: CreateSupplierPoRequest = {
        supplierId: "sup-001",
        lines: [{ description: "Steel", quantity: "1", unitPrice: "10", taxRatePercent: "0" }],
      };

      const result = await controller.create(principal, "biz-001", input, "req-001");
      expect(service.createSupplierPo).toHaveBeenCalledWith(
        "user-001",
        "biz-001",
        input,
        "req-001",
      );
      expect(result).toEqual(supplierPoMock);
    });

    it("delegates list to ProcurementService", async () => {
      const service = buildService();
      const controller = new SupplierPosController(service);

      const result = await controller.list(principal, "biz-001");
      expect(service.listSupplierPos).toHaveBeenCalledWith("user-001", "biz-001");
      expect(result).toEqual([supplierPoMock]);
    });

    it("delegates get to ProcurementService", async () => {
      const service = buildService();
      const controller = new SupplierPosController(service);

      const result = await controller.get(principal, "biz-001", "spo-001");
      expect(service.getSupplierPo).toHaveBeenCalledWith("user-001", "biz-001", "spo-001");
      expect(result).toEqual(supplierPoMock);
    });

    it("delegates issue to ProcurementService", async () => {
      const service = buildService();
      const controller = new SupplierPosController(service);

      const result = await controller.issue(principal, "biz-001", "spo-001", "req-002");
      expect(service.issueSupplierPo).toHaveBeenCalledWith(
        "user-001",
        "biz-001",
        "spo-001",
        "req-002",
      );
      expect(result.status).toBe("ISSUED");
    });
  });

  describe("SupplierBillsController", () => {
    it("delegates create to ProcurementService", async () => {
      const service = buildService();
      const controller = new SupplierBillsController(service);
      const input: CreateSupplierBillRequest = {
        supplierId: "sup-001",
        billNumber: "INV-001",
        billDate: "2026-08-01",
        lines: [{ description: "Item", quantity: "1", unitPrice: "10", taxRatePercent: "0" }],
      };

      const result = await controller.create(principal, "biz-001", input, "req-003");
      expect(service.createSupplierBill).toHaveBeenCalledWith(
        "user-001",
        "biz-001",
        input,
        "req-003",
      );
      expect(result).toEqual(supplierBillMock);
    });

    it("delegates list to ProcurementService", async () => {
      const service = buildService();
      const controller = new SupplierBillsController(service);

      const result = await controller.list(principal, "biz-001");
      expect(service.listSupplierBills).toHaveBeenCalledWith("user-001", "biz-001");
      expect(result).toEqual([supplierBillMock]);
    });
  });

  describe("GrnsController", () => {
    it("delegates create to ProcurementService", async () => {
      const service = buildService();
      const controller = new GrnsController(service);
      const input: CreateGrnRequest = {
        supplierId: "sup-001",
        lines: [{ description: "Item", quantity: "5" }],
      };

      const result = await controller.create(principal, "biz-001", input, "req-004");
      expect(service.createGrn).toHaveBeenCalledWith("user-001", "biz-001", input, "req-004");
      expect(result).toEqual(grnMock);
    });

    it("delegates list to ProcurementService", async () => {
      const service = buildService();
      const controller = new GrnsController(service);

      const result = await controller.list(principal, "biz-001");
      expect(service.listGrns).toHaveBeenCalledWith("user-001", "biz-001");
      expect(result).toEqual([grnMock]);
    });
  });
});
