import { BadRequestException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DocumentStatus,
  DocumentType,
  InvoiceApprovalStatus,
  PurchaseOrderStatus,
} from "@bizo/database";

import { type ConfigurationService } from "../configuration/configuration.service.js";
import { type DatabaseService } from "../database/database.service.js";
import { type BusinessAccessService } from "../security/business-access.service.js";
import { PurchaseOrdersService } from "./purchase-orders.service.js";

const access = {
  businessId: 11n,
  businessPublicId: "60d73986-e757-4629-9e20-d6f851e58b02",
  membershipId: 13n,
  role: "OWNER" as const,
  tenantId: 17n,
  tenantPublicId: "3cd6c286-3efe-4990-8dbf-ca9c06c3e423",
  userId: 19n,
  userPublicId: "9dc31c21-87e7-4aa5-a1ac-648ebc812028",
};

const configuration = {
  getInvoiceConversionPolicy: vi.fn().mockResolvedValue({
    customerPoRequired: true,
    approvalEvidenceRequired: true,
    templateCode: "service-po-approval",
    templateVersion: "1.0.0",
  }),
} as unknown as ConfigurationService;

describe("PurchaseOrdersService", () => {
  const objectStore = {
    put: vi.fn(),
    get: vi.fn(),
  };
  const businessAccess = {
    resolve: vi.fn(),
    assertAllowed: vi.fn(),
  };
  const transaction = {
    $executeRaw: vi.fn(),
    customer: { findFirst: vi.fn() },
    document: { findFirst: vi.fn(), create: vi.fn() },
    purchaseOrder: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    business: { findUniqueOrThrow: vi.fn() },
    businessSettings: { update: vi.fn() },
    storedObject: { updateMany: vi.fn(), create: vi.fn(), findFirst: vi.fn() },
    auditEvent: { create: vi.fn() },
  };
  const database = {
    withScope: vi.fn(async (_scope, work) => work(transaction)),
  };

  let service: PurchaseOrdersService;

  beforeEach(() => {
    vi.clearAllMocks();
    businessAccess.resolve.mockResolvedValue(access);
    businessAccess.assertAllowed.mockResolvedValue(undefined);
    service = new PurchaseOrdersService(
      database as unknown as DatabaseService,
      businessAccess as unknown as BusinessAccessService,
      objectStore,
      configuration,
    );
  });

  it("creates a purchase order and audits the event", async () => {
    transaction.customer.findFirst.mockResolvedValue({
      id: 5n,
      publicId: "11111111-1111-4111-8111-111111111111",
    });
    transaction.purchaseOrder.create.mockResolvedValue({
      publicId: "22222222-2222-4222-8222-222222222222",
      status: PurchaseOrderStatus.ACTIVE,
      poNumber: "PO-9",
      poDate: null,
      projectReference: null,
      amountMinor: null,
      currencyCode: null,
      currencyScale: null,
      notes: null,
      approvalStatus: InvoiceApprovalStatus.NOT_RECORDED,
      approvalChangedAt: null,
      createdAt: new Date("2026-07-27T00:00:00.000Z"),
      updatedAt: new Date("2026-07-27T00:00:00.000Z"),
      customerId: 5n,
      quotationId: null,
      customer: { publicId: "11111111-1111-4111-8111-111111111111", name: "Acme" },
      quotation: null,
      storedObjects: [],
    });

    const created = await service.create(
      access.userPublicId,
      access.businessPublicId,
      {
        customerId: "11111111-1111-4111-8111-111111111111",
        quotationId: null,
        poNumber: "PO-9",
        poDate: null,
        projectReference: null,
        amountMinor: null,
        currencyCode: null,
        currencyScale: null,
        notes: null,
      },
      "req-1",
    );

    expect(created.poNumber).toBe("PO-9");
    expect(created.readiness.code).toBe("APPROVAL_PENDING");
    expect(transaction.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "purchase_order.created" }),
      }),
    );
  });

  it("rejects quotation links for a different customer", async () => {
    transaction.customer.findFirst.mockResolvedValue({
      id: 5n,
      publicId: "11111111-1111-4111-8111-111111111111",
    });
    transaction.document.findFirst.mockResolvedValue({
      id: 9n,
      publicId: "33333333-3333-4333-8333-333333333333",
      type: DocumentType.QUOTATION,
      customerId: 99n,
    });

    await expect(
      service.create(
        access.userPublicId,
        access.businessPublicId,
        {
          customerId: "11111111-1111-4111-8111-111111111111",
          quotationId: "33333333-3333-4333-8333-333333333333",
          poNumber: "PO-9",
          poDate: null,
          projectReference: null,
          amountMinor: null,
          currencyCode: null,
          currencyScale: null,
          notes: null,
        },
        "req-2",
      ),
    ).rejects.toThrow(/same customer/);
  });

  it("hides missing purchase orders as not found", async () => {
    transaction.purchaseOrder.findFirst.mockResolvedValue(null);
    await expect(
      service.get(
        access.userPublicId,
        access.businessPublicId,
        "44444444-4444-4444-8444-444444444444",
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  describe("convertToBill", () => {
    const purchaseOrderPublicId = "55555555-5555-4555-8555-555555555555";
    const decimal = (value: string) => ({
      toString: () => value,
      toFixed: () => value,
    });

    const approvedPurchaseOrder = () => ({
      id: 42n,
      publicId: purchaseOrderPublicId,
      poNumber: "PO-77",
      projectReference: "Project Falcon",
      notes: "Deliver by Q3.",
      status: PurchaseOrderStatus.ACTIVE,
      approvalStatus: InvoiceApprovalStatus.APPROVED,
      amountMinor: decimal("150000"),
      currencyCode: "SAR",
      currencyScale: 2,
      supplier: {
        id: 7n,
        publicId: "66666666-6666-4666-8666-666666666666",
        name: "Falcon Supplies",
        email: "ap@falcon.example",
        phone: "+966500000000",
      },
    });

    const billRecord = () => ({
      publicId: "77777777-7777-4777-8777-777777777777",
      number: "BILL-0004",
      status: DocumentStatus.DRAFT,
      issueDate: new Date("2026-08-19T00:00:00.000Z"),
      dueDate: null,
      currencyCode: "SAR",
      currencyScale: 2,
      subtotalMinor: decimal("150000"),
      taxMinor: decimal("0"),
      totalMinor: decimal("150000"),
      notes: "Deliver by Q3.",
      supplier: {
        publicId: "66666666-6666-4666-8666-666666666666",
        name: "Falcon Supplies",
        email: "ap@falcon.example",
        phone: "+966500000000",
      },
      lines: [
        {
          position: 1,
          description: "Purchase order PO-77 (Project Falcon)",
          quantity: decimal("1"),
          unitPriceMinor: decimal("150000"),
          taxRatePpm: 0,
          subtotalMinor: decimal("150000"),
          taxMinor: decimal("0"),
          totalMinor: decimal("150000"),
        },
      ],
      createdAt: new Date("2026-08-19T00:00:00.000Z"),
      updatedAt: new Date("2026-08-19T00:00:00.000Z"),
    });

    it("converts an approved purchase order into a draft supplier bill", async () => {
      transaction.purchaseOrder.findFirst.mockResolvedValue(approvedPurchaseOrder());
      transaction.document.findFirst.mockResolvedValue(null);
      transaction.business.findUniqueOrThrow.mockResolvedValue({ timeZone: "UTC" });
      transaction.businessSettings.update.mockResolvedValue({
        nextSupplierBillNumber: 5,
        supplierBillPrefix: "BILL",
      });
      transaction.document.create.mockResolvedValue(billRecord());

      const bill = await service.convertToBill(
        access.userPublicId,
        access.businessPublicId,
        purchaseOrderPublicId,
        "req-convert",
      );

      expect(bill.number).toBe("BILL-0004");
      expect(bill.status).toBe("DRAFT");
      expect(bill.matchStatus).toBe("NO_PO");
      expect(bill.supplierPo).toBeNull();
      expect(bill.supplier.name).toBe("Falcon Supplies");
      expect(bill.subtotalMinor).toBe("150000");
      expect(bill.taxMinor).toBe("0");
      expect(bill.totalMinor).toBe("150000");
      expect(bill.lines).toHaveLength(1);

      // Advisory lock is taken before any read so concurrent converts serialize.
      expect(transaction.$executeRaw).toHaveBeenCalledTimes(1);
      expect(transaction.document.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: DocumentType.SUPPLIER_BILL,
            status: DocumentStatus.DRAFT,
            number: "BILL-0004",
            purchaseOrderId: 42n,
            supplierId: 7n,
            poNumberSnapshot: "PO-77",
            subtotalMinor: "150000",
            taxMinor: "0",
            totalMinor: "150000",
          }),
        }),
      );
      expect(transaction.auditEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "supplier_bill.created",
            after: expect.objectContaining({ sourcePurchaseOrderId: purchaseOrderPublicId }),
          }),
        }),
      );
    });

    it("is idempotent: returns the existing bill without creating a duplicate", async () => {
      transaction.purchaseOrder.findFirst.mockResolvedValue(approvedPurchaseOrder());
      transaction.document.findFirst.mockResolvedValue(billRecord());

      const bill = await service.convertToBill(
        access.userPublicId,
        access.businessPublicId,
        purchaseOrderPublicId,
        "req-convert-again",
      );

      expect(bill.number).toBe("BILL-0004");
      expect(transaction.document.create).not.toHaveBeenCalled();
      expect(transaction.businessSettings.update).not.toHaveBeenCalled();
      expect(transaction.auditEvent.create).not.toHaveBeenCalled();
    });

    it("rejects purchase orders that are not approved", async () => {
      transaction.purchaseOrder.findFirst.mockResolvedValue({
        ...approvedPurchaseOrder(),
        approvalStatus: InvoiceApprovalStatus.PENDING,
      });
      transaction.document.findFirst.mockResolvedValue(null);

      await expect(
        service.convertToBill(
          access.userPublicId,
          access.businessPublicId,
          purchaseOrderPublicId,
          "req-not-approved",
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(transaction.document.create).not.toHaveBeenCalled();
    });

    it("hides a missing purchase order as not found", async () => {
      transaction.purchaseOrder.findFirst.mockResolvedValue(null);

      await expect(
        service.convertToBill(
          access.userPublicId,
          access.businessPublicId,
          purchaseOrderPublicId,
          "req-missing",
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(transaction.document.create).not.toHaveBeenCalled();
    });
  });
});
