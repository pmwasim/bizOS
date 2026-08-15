import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { type DatabaseService } from "../database/database.service.js";
import { type BusinessAccessService } from "../security/business-access.service.js";
import { ProjectsService } from "./projects.service.js";

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

const CUSTOMER = {
  id: 500n,
  publicId: "c0000000-0000-4000-8000-000000000001",
  name: "Test Customer Co",
};

function projectRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 900n,
    publicId: "p0000000-0000-4000-8000-000000000001",
    name: "Website Revamp",
    description: null,
    status: "ACTIVE",
    startDate: null,
    endDate: null,
    budgetMinor: null,
    currencyCode: null,
    notes: null,
    customer: null,
    createdAt: new Date("2026-08-07T00:00:00.000Z"),
    updatedAt: new Date("2026-08-07T00:00:00.000Z"),
    ...overrides,
  };
}

function createDatabaseMock(
  initial: ReturnType<typeof projectRecord> | null = null,
  customerLookup: typeof CUSTOMER | null = CUSTOMER,
) {
  let row = initial;
  const auditEvents: unknown[] = [];
  const customer = { findFirst: vi.fn().mockResolvedValue(customerLookup) };
  const project = {
    create: vi.fn().mockImplementation(async (args: { data: Record<string, unknown> }) => {
      row = projectRecord({ ...args.data, id: 900n, publicId: projectRecord().publicId });
      return row;
    }),
    findMany: vi.fn().mockImplementation(async () => (row ? [row] : [])),
    findFirst: vi.fn().mockImplementation(async () => row),
    update: vi.fn().mockImplementation(async (args: { data: Record<string, unknown> }) => {
      row = { ...(row as Record<string, unknown>), ...args.data } as ReturnType<
        typeof projectRecord
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
  const transaction = { customer, project, auditEvent };
  const database = {
    withScope: vi
      .fn()
      .mockImplementation(async (_access: unknown, work: (scope: typeof transaction) => unknown) =>
        work(transaction),
      ),
  };
  return { database: database as unknown as DatabaseService, project, auditEvents };
}

describe("ProjectsService", () => {
  it("creates a project without a customer", async () => {
    const access = createBusinessAccessMock();
    const { database, project, auditEvents } = createDatabaseMock();
    const service = new ProjectsService(database, access);

    const result = await service.create(
      ACCESS.userPublicId,
      ACCESS.businessPublicId,
      { name: "Website Revamp" },
      "req-1",
    );

    expect(access.assertAllowed).toHaveBeenCalledWith(ACCESS, "projects", "create");
    expect(project.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: "Website Revamp", customerId: null }),
      }),
    );
    expect(result.status).toBe("ACTIVE");
    expect(result.customer).toBeNull();
    expect(auditEvents).toHaveLength(1);
  });

  it("resolves customerId when a customer is referenced", async () => {
    const access = createBusinessAccessMock();
    const { database, project } = createDatabaseMock();
    const service = new ProjectsService(database, access);

    await service.create(
      ACCESS.userPublicId,
      ACCESS.businessPublicId,
      { name: "Website Revamp", customerId: CUSTOMER.publicId },
      "req-2",
    );

    expect(project.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ customerId: CUSTOMER.id }) }),
    );
  });

  it("throws NotFoundException when the referenced customer does not exist", async () => {
    const access = createBusinessAccessMock();
    const { database } = createDatabaseMock(null, null);
    const service = new ProjectsService(database, access);

    await expect(
      service.create(
        ACCESS.userPublicId,
        ACCESS.businessPublicId,
        { name: "Website Revamp", customerId: "missing-customer" },
        "req-3",
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("get() throws NotFoundException for a project outside the business", async () => {
    const access = createBusinessAccessMock();
    const { database } = createDatabaseMock(null);
    const service = new ProjectsService(database, access);

    await expect(
      service.get(ACCESS.userPublicId, ACCESS.businessPublicId, "missing"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("update() only overwrites fields explicitly present in the request", async () => {
    const access = createBusinessAccessMock();
    const { database, project } = createDatabaseMock(
      projectRecord({ status: "ACTIVE", notes: "keep" }),
    );
    const service = new ProjectsService(database, access);

    await service.update(
      ACCESS.userPublicId,
      ACCESS.businessPublicId,
      "p0000000-0000-4000-8000-000000000001",
      { status: "COMPLETED" },
      "req-4",
    );

    expect(project.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "COMPLETED", notes: "keep" }),
      }),
    );
  });
});
