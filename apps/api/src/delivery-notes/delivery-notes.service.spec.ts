import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { type DatabaseService } from "../database/database.service.js";
import { type BusinessAccessService } from "../security/business-access.service.js";
import { DeliveryNotesService } from "./delivery-notes.service.js";

const ACCESS = {
  businessId: 44n,
  businessPublicId: "b0000000-0000-4000-8000-000000000001",
  membershipId: 300n,
  role: "OWNER" as const,
  tenantId: 100n,
  tenantPublicId: "t0000000-0000-4000-8000-000000000001",
  userId: 1n,
  userPublicId: "u0000000-0000-4000-8000-000000000001",
};

const CUSTOMER = {
  id: 500n,
  publicId: "c0000000-0000-4000-8000-000000000001",
  name: "Test Customer Co",
  email: null,
  phone: null,
};

const BUSINESS = { id: 44n, baseCurrency: "SAR", currencyScale: 2, settings: { id: 44n } };
const ITEM = "i0000000-0000-4000-8000-000000000001";

function createBusinessAccessMock(): BusinessAccessService {
  return {
    resolve: vi.fn().mockResolvedValue(ACCESS),
    assertAllowed: vi.fn(),
  } as unknown as BusinessAccessService;
}

function documentRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 900n,
    publicId: "dn0000000-0000-4000-8000-000000000001",
    number: "DN-0001",
    deliveryDate: null,
    notes: null,
    receivedAt: null,
    customer: CUSTOMER,
    sourceDocument: null,
    lines: [{ position: 1, description: "3x widgets", quantity: "3" }],
    createdAt: new Date("2026-08-07T00:00:00.000Z"),
    updatedAt: new Date("2026-08-07T00:00:00.000Z"),
    ...overrides,
  };
}

function createDatabaseMock(initial: ReturnType<typeof documentRecord> | null = null) {
  let row = initial;
  const auditEvents: unknown[] = [];
  const business = { findUniqueOrThrow: vi.fn().mockResolvedValue(BUSINESS) };
  const businessSettings = {
    update: vi.fn().mockResolvedValue({ nextDeliveryNoteNumber: 2, deliveryNotePrefix: "DN" }),
  };
  const customer = { findFirst: vi.fn().mockResolvedValue(CUSTOMER) };
  const document = {
    create: vi.fn().mockImplementation(async (args: { data: Record<string, unknown> }) => {
      row = documentRecord({
        ...args.data,
        id: 900n,
        publicId: documentRecord().publicId,
        customer: CUSTOMER,
        sourceDocument: null,
        lines: [{ position: 1, description: "3x widgets", quantity: "3" }],
      });
      return row;
    }),
    findMany: vi.fn().mockImplementation(async () => (row ? [row] : [])),
    findFirst: vi.fn().mockImplementation(async () => row),
    update: vi.fn().mockImplementation(async (args: { data: Record<string, unknown> }) => {
      row = { ...(row as Record<string, unknown>), ...args.data } as ReturnType<
        typeof documentRecord
      >;
      return row;
    }),
  };
  const auditEvent = {
    create: vi.fn().mockImplementation(async (args: { data: unknown }) => {
      auditEvents.push(args.data);
      return args.data;
    }),
  };
  const transaction = { business, businessSettings, customer, document, auditEvent };
  const database = {
    withScope: vi
      .fn()
      .mockImplementation(async (_access: unknown, work: (scope: typeof transaction) => unknown) =>
        work(transaction),
      ),
  };
  return { database: database as unknown as DatabaseService, document, auditEvents };
}

describe("DeliveryNotesService", () => {
  it("creates a delivery note with the required Document columns populated (no money, no natural expiry)", async () => {
    const access = createBusinessAccessMock();
    const { database, document, auditEvents } = createDatabaseMock();
    const service = new DeliveryNotesService(database, access);

    const result = await service.create(
      ACCESS.userPublicId,
      ACCESS.businessPublicId,
      { customerId: CUSTOMER.publicId, lines: [{ description: "3x widgets", quantity: "3" }] },
      "req-1",
    );

    expect(access.assertAllowed).toHaveBeenCalledWith(ACCESS, "delivery_notes", "create");
    // This is the exact bug this session found: create() never set validUntil / currencyCode /
    // currencyScale / subtotalMinor / taxMinor / totalMinor -- all required, not-null columns on
    // the shared Document table.
    expect(document.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          validUntil: expect.anything(),
          currencyCode: "SAR",
          currencyScale: 2,
          subtotalMinor: "0",
          taxMinor: "0",
          totalMinor: "0",
        }),
      }),
    );
    expect(result.status).toBe("DRAFT");
    expect(auditEvents).toHaveLength(1);
  });

  it("get() throws NotFoundException for a delivery note outside the business", async () => {
    const access = createBusinessAccessMock();
    const { database } = createDatabaseMock(null);
    const service = new DeliveryNotesService(database, access);

    await expect(
      service.get(ACCESS.userPublicId, ACCESS.businessPublicId, "missing"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("markDelivered() stamps receivedAt and flips the mapped status to DELIVERED", async () => {
    const access = createBusinessAccessMock();
    const { database, document } = createDatabaseMock(documentRecord());
    const service = new DeliveryNotesService(database, access);

    const result = await service.markDelivered(
      ACCESS.userPublicId,
      ACCESS.businessPublicId,
      "dn0000000-0000-4000-8000-000000000001",
      "req-2",
    );

    expect(document.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ receivedAt: expect.any(Date) }) }),
    );
    expect(result.status).toBe("DELIVERED");
  });

  it("passes delivered quantities to stock fulfillment for partial delivery", async () => {
    const access = createBusinessAccessMock();
    const record = documentRecord({
      sourceDocument: {
        id: 901n,
        publicId: "so0000000-0000-4000-8000-000000000001",
        number: "SO-0001",
        lines: [
          {
            position: 1,
            description: "Widget",
            quantity: "10",
            inventoryItem: { publicId: ITEM },
          },
        ],
      },
      lines: [{ position: 1, description: "Widget", quantity: "3" }],
    });
    const { database } = createDatabaseMock(record);
    const inventory = { fulfillDocumentStock: vi.fn().mockResolvedValue(undefined) };
    const service = new DeliveryNotesService(database, access, inventory as never);

    await service.markDelivered(
      ACCESS.userPublicId,
      ACCESS.businessPublicId,
      record.publicId,
      "req-partial-delivery",
    );

    expect(inventory.fulfillDocumentStock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      901n,
      "so0000000-0000-4000-8000-000000000001",
      "req-partial-delivery",
      [{ inventoryItemId: ITEM, quantity: "3" }],
    );
  });
});
