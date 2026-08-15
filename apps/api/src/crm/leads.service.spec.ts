import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { type DatabaseService } from "../database/database.service.js";
import { type BusinessAccessService } from "../security/business-access.service.js";
import { LeadsService } from "./leads.service.js";

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

function createBusinessAccessMock(): BusinessAccessService {
  return {
    resolve: vi.fn().mockResolvedValue(ACCESS),
    assertAllowed: vi.fn(),
  } as unknown as BusinessAccessService;
}

function leadRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 900n,
    publicId: "l0000000-0000-4000-8000-000000000001",
    name: "Jane Prospect",
    company: null,
    email: null,
    phone: null,
    source: null,
    status: "NEW",
    estimatedValue: null,
    currencyCode: null,
    notes: null,
    convertedAt: null,
    createdAt: new Date("2026-08-07T00:00:00.000Z"),
    updatedAt: new Date("2026-08-07T00:00:00.000Z"),
    ...overrides,
  };
}

function createDatabaseMock(initial: ReturnType<typeof leadRecord> | null = null) {
  let row = initial;
  const auditEvents: unknown[] = [];
  const lead = {
    create: vi.fn().mockImplementation(async (args: { data: Record<string, unknown> }) => {
      row = leadRecord({ ...args.data, id: 900n, publicId: leadRecord().publicId });
      return row;
    }),
    findMany: vi.fn().mockImplementation(async () => (row ? [row] : [])),
    findFirst: vi.fn().mockImplementation(async () => row),
    update: vi.fn().mockImplementation(async (args: { data: Record<string, unknown> }) => {
      row = { ...(row as Record<string, unknown>), ...args.data } as ReturnType<typeof leadRecord>;
      return row;
    }),
  };
  const auditEvent = {
    create: vi.fn().mockImplementation(async (args: { data: unknown }) => {
      auditEvents.push(args.data);
      return args.data;
    }),
  };
  const transaction = { lead, auditEvent };
  const database = {
    withScope: vi
      .fn()
      .mockImplementation(async (_access: unknown, work: (scope: typeof transaction) => unknown) =>
        work(transaction),
      ),
  };
  return { database: database as unknown as DatabaseService, lead, auditEvent, auditEvents };
}

describe("LeadsService", () => {
  it("creates a lead, records an audit event, and defaults status to NEW", async () => {
    const access = createBusinessAccessMock();
    const { database, lead, auditEvents } = createDatabaseMock();
    const service = new LeadsService(database, access);

    const result = await service.create(
      ACCESS.userPublicId,
      ACCESS.businessPublicId,
      {
        name: "Jane Prospect",
        company: "Prospect Inc",
        email: null,
        phone: null,
        source: "referral",
        estimatedValue: null,
        currencyCode: null,
        notes: null,
      },
      "req-1",
    );

    expect(access.resolve).toHaveBeenCalledWith(ACCESS.userPublicId, ACCESS.businessPublicId);
    expect(access.assertAllowed).toHaveBeenCalledWith(ACCESS, "crm", "create");
    expect(lead.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: ACCESS.tenantId,
          businessId: ACCESS.businessId,
          name: "Jane Prospect",
          company: "Prospect Inc",
          source: "referral",
        }),
      }),
    );
    expect(result.status).toBe("NEW");
    expect(result.name).toBe("Jane Prospect");
    expect(auditEvents).toHaveLength(1);
    expect(auditEvents[0]).toMatchObject({ action: "lead.created", requestId: "req-1" });
  });

  it("lists leads scoped to the business", async () => {
    const access = createBusinessAccessMock();
    const { database, lead } = createDatabaseMock(leadRecord());
    const service = new LeadsService(database, access);

    const result = await service.list(ACCESS.userPublicId, ACCESS.businessPublicId);

    expect(access.assertAllowed).toHaveBeenCalledWith(ACCESS, "crm", "read");
    expect(lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { businessId: ACCESS.businessId } }),
    );
    expect(result).toHaveLength(1);
  });

  it("throws NotFoundException when getting a lead that does not exist", async () => {
    const access = createBusinessAccessMock();
    const { database } = createDatabaseMock(null);
    const service = new LeadsService(database, access);

    await expect(
      service.get(ACCESS.userPublicId, ACCESS.businessPublicId, "missing-lead"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("update() only overwrites fields explicitly present in the request", async () => {
    const access = createBusinessAccessMock();
    const { database, lead } = createDatabaseMock(leadRecord({ notes: "original notes" }));
    const service = new LeadsService(database, access);

    await service.update(
      ACCESS.userPublicId,
      ACCESS.businessPublicId,
      "l0000000-0000-4000-8000-000000000001",
      { name: "Jane Updated" },
      "req-2",
    );

    expect(lead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: "Jane Updated", notes: "original notes" }),
      }),
    );
  });

  it("convert() sets status to CONVERTED and stamps convertedAt", async () => {
    const access = createBusinessAccessMock();
    const { database, lead, auditEvents } = createDatabaseMock(leadRecord());
    const service = new LeadsService(database, access);

    const result = await service.convert(
      ACCESS.userPublicId,
      ACCESS.businessPublicId,
      "l0000000-0000-4000-8000-000000000001",
      "req-3",
    );

    expect(lead.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "CONVERTED" }) }),
    );
    expect(result.status).toBe("CONVERTED");
    expect(result.convertedAt).not.toBeNull();
    expect(auditEvents.map((e) => (e as { action: string }).action)).toContain("lead.converted");
  });
});
