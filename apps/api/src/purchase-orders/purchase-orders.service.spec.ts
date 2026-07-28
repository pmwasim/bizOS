import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DocumentType, InvoiceApprovalStatus, PurchaseOrderStatus } from "@bizo/database";

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
    customer: { findFirst: vi.fn() },
    document: { findFirst: vi.fn() },
    purchaseOrder: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
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
});
