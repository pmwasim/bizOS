import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { type DatabaseService } from "../database/database.service.js";
import { type BusinessAccessService } from "../security/business-access.service.js";
import { OpportunitiesService } from "./opportunities.service.js";

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

function opportunityRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 900n,
    publicId: "o0000000-0000-4000-8000-000000000001",
    name: "Website Revamp Deal",
    stage: "PROSPECTING",
    probability: null,
    amountMinor: null,
    currencyCode: null,
    expectedCloseDate: null,
    actualCloseDate: null,
    notes: null,
    lead: null,
    quotation: null,
    createdAt: new Date("2026-08-07T00:00:00.000Z"),
    updatedAt: new Date("2026-08-07T00:00:00.000Z"),
    ...overrides,
  };
}

function createDatabaseMock(initial: ReturnType<typeof opportunityRecord> | null = null) {
  let row = initial;
  const auditEvents: unknown[] = [];
  const lead = {
    findFirst: vi
      .fn()
      .mockResolvedValue({ id: 500n, publicId: "l0000000-0000-4000-8000-000000000001" }),
  };
  const opportunity = {
    create: vi.fn().mockImplementation(async (args: { data: Record<string, unknown> }) => {
      row = opportunityRecord({ ...args.data, id: 900n, publicId: opportunityRecord().publicId });
      return row;
    }),
    findMany: vi.fn().mockImplementation(async () => (row ? [row] : [])),
    findFirst: vi.fn().mockImplementation(async () => row),
    update: vi.fn().mockImplementation(async (args: { data: Record<string, unknown> }) => {
      row = { ...(row as Record<string, unknown>), ...args.data } as ReturnType<
        typeof opportunityRecord
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
  const transaction = { lead, opportunity, auditEvent };
  const database = {
    withScope: vi
      .fn()
      .mockImplementation(async (_access: unknown, work: (scope: typeof transaction) => unknown) =>
        work(transaction),
      ),
  };
  return { database: database as unknown as DatabaseService, opportunity, auditEvents };
}

describe("OpportunitiesService", () => {
  it("creates an opportunity with a default stage and no lead", async () => {
    const access = createBusinessAccessMock();
    const { database, opportunity, auditEvents } = createDatabaseMock();
    const service = new OpportunitiesService(database, access);

    const result = await service.create(
      ACCESS.userPublicId,
      ACCESS.businessPublicId,
      { name: "Website Revamp Deal" },
      "req-1",
    );

    expect(access.assertAllowed).toHaveBeenCalledWith(ACCESS, "crm", "create");
    expect(opportunity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Website Revamp Deal",
          stage: "PROSPECTING",
          leadId: null,
        }),
      }),
    );
    expect(result.stage).toBe("PROSPECTING");
    expect(result.quotation).toBeNull();
    expect(auditEvents).toHaveLength(1);
  });

  it("resolves leadId when a lead is referenced and throws NotFoundException otherwise", async () => {
    const access = createBusinessAccessMock();
    const { database, opportunity } = createDatabaseMock();
    const service = new OpportunitiesService(database, access);

    await service.create(
      ACCESS.userPublicId,
      ACCESS.businessPublicId,
      { leadId: "l0000000-0000-4000-8000-000000000001", name: "Deal" },
      "req-2",
    );
    expect(opportunity.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ leadId: 500n }) }),
    );

    const missingLeadDb = createDatabaseMock();
    missingLeadDb.database = {
      withScope: vi.fn().mockImplementation(async (_a: unknown, work: (s: unknown) => unknown) =>
        work({
          lead: { findFirst: vi.fn().mockResolvedValue(null) },
          opportunity: missingLeadDb.opportunity,
          auditEvent: { create: vi.fn() },
        }),
      ),
    } as unknown as DatabaseService;
    const serviceWithMissingLead = new OpportunitiesService(missingLeadDb.database, access);
    await expect(
      serviceWithMissingLead.create(
        ACCESS.userPublicId,
        ACCESS.businessPublicId,
        { leadId: "l0000000-0000-4000-8000-000000000099", name: "Deal" },
        "req-3",
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("get() throws NotFoundException for an opportunity outside the business", async () => {
    const access = createBusinessAccessMock();
    const { database } = createDatabaseMock(null);
    const service = new OpportunitiesService(database, access);

    await expect(
      service.get(ACCESS.userPublicId, ACCESS.businessPublicId, "missing"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("update() only overwrites fields explicitly present in the request", async () => {
    const access = createBusinessAccessMock();
    const { database, opportunity } = createDatabaseMock(
      opportunityRecord({ probability: 20, notes: "keep me" }),
    );
    const service = new OpportunitiesService(database, access);

    await service.update(
      ACCESS.userPublicId,
      ACCESS.businessPublicId,
      "o0000000-0000-4000-8000-000000000001",
      { stage: "PROPOSAL" },
      "req-4",
    );

    expect(opportunity.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ stage: "PROPOSAL", probability: 20, notes: "keep me" }),
      }),
    );
  });

  it("maps the linked quotation record onto the public `quotation` field", async () => {
    const access = createBusinessAccessMock();
    const { database } = createDatabaseMock(
      opportunityRecord({
        quotation: { publicId: "q0000000-0000-4000-8000-000000000001", number: "Q-0001" },
      }),
    );
    const service = new OpportunitiesService(database, access);

    const result = await service.get(
      ACCESS.userPublicId,
      ACCESS.businessPublicId,
      "o0000000-0000-4000-8000-000000000001",
    );

    expect(result.quotation).toEqual({
      id: "q0000000-0000-4000-8000-000000000001",
      number: "Q-0001",
    });
  });
});
