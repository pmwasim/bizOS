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
    score: 0,
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
    updateMany: vi
      .fn()
      .mockImplementation(
        async (args: { where?: { status?: { not?: string } }; data: Record<string, unknown> }) => {
          const excluded = args.where?.status?.not;
          if (excluded !== undefined && (row as { status?: string } | null)?.status === excluded) {
            return { count: 0 };
          }
          row = {
            ...(row as Record<string, unknown>),
            ...args.data,
          } as ReturnType<typeof leadRecord>;
          return { count: 1 };
        },
      ),
    findUniqueOrThrow: vi.fn().mockImplementation(async () => {
      if (!row) throw new Error("lead not found");
      return row;
    }),
  };
  const opportunities: Array<Record<string, unknown>> = [];
  const opportunity = {
    create: vi.fn().mockImplementation(async (args: { data: Record<string, unknown> }) => {
      const created = {
        ...args.data,
        id: 700n,
        publicId: "o0000000-0000-4000-8000-000000000001",
      };
      opportunities.push(created);
      return created;
    }),
    findFirst: vi
      .fn()
      .mockImplementation(async () =>
        opportunities.length > 0 ? opportunities[opportunities.length - 1] : null,
      ),
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
  return {
    database: database as unknown as DatabaseService,
    lead,
    opportunity,
    auditEvent,
    auditEvents,
    opportunities,
  };
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

  it("create() computes and persists a deterministic score", async () => {
    const access = createBusinessAccessMock();
    const { database, lead } = createDatabaseMock();
    const service = new LeadsService(database, access);

    const result = await service.create(
      ACCESS.userPublicId,
      ACCESS.businessPublicId,
      {
        name: "Jane Prospect",
        company: "Prospect Inc",
        email: "jane@prospect.example",
        phone: "+1 555 123 4567",
        source: "referral",
        estimatedValue: null,
        currencyCode: null,
        notes: null,
      },
      "req-score",
    );

    // email 12 + phone 10 + company 8 + referral 20 + no value 0 + NEW 0 = 50
    expect(result.score).toBe(50);
    expect(lead.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ score: 50 }) }),
    );
  });

  it("update() recomputes the score from the merged lead state", async () => {
    const access = createBusinessAccessMock();
    const { database, lead } = createDatabaseMock(
      leadRecord({ email: "j@x.example", company: "Acme", source: "web", score: 0 }),
    );
    const service = new LeadsService(database, access);

    const result = await service.update(
      ACCESS.userPublicId,
      ACCESS.businessPublicId,
      "l0000000-0000-4000-8000-000000000001",
      { name: "Jane Prospect", status: "QUALIFIED" },
      "req-upd",
    );

    // email 12 + company 8 + web 12 + no value 0 + QUALIFIED 18 = 50
    expect(result.score).toBe(50);
    expect(lead.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ score: 50 }) }),
    );
  });

  it("convert() sets CONVERTED, creates a linked opportunity, and returns its id", async () => {
    const access = createBusinessAccessMock();
    const { database, lead, opportunity, auditEvents } = createDatabaseMock(
      leadRecord({
        company: "Prospect Inc",
        estimatedValue: { toFixed: () => "250000" },
        currencyCode: "USD",
      }),
    );
    const service = new LeadsService(database, access);

    const result = await service.convert(
      ACCESS.userPublicId,
      ACCESS.businessPublicId,
      "l0000000-0000-4000-8000-000000000001",
      "req-3",
    );

    expect(lead.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { not: "CONVERTED" } }),
        data: expect.objectContaining({ status: "CONVERTED" }),
      }),
    );
    expect(opportunity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leadId: 900n,
          name: "Prospect Inc",
          stage: "PROSPECTING",
          currencyCode: "USD",
        }),
      }),
    );
    expect(result.status).toBe("CONVERTED");
    expect(result.convertedAt).not.toBeNull();
    expect(result.opportunityId).toBe("o0000000-0000-4000-8000-000000000001");
    expect(auditEvents.map((e) => (e as { action: string }).action)).toEqual(
      expect.arrayContaining(["lead.converted", "opportunity.created"]),
    );
  });

  it("convert() is idempotent: an already-converted lead spawns no second opportunity", async () => {
    const access = createBusinessAccessMock();
    const { database, opportunity } = createDatabaseMock(
      leadRecord({ status: "CONVERTED", convertedAt: new Date("2026-08-07T00:00:00.000Z") }),
    );
    // Pretend the original conversion already created an opportunity.
    await opportunity.create({ data: { leadId: 900n } });
    opportunity.create.mockClear();
    const service = new LeadsService(database, access);

    const result = await service.convert(
      ACCESS.userPublicId,
      ACCESS.businessPublicId,
      "l0000000-0000-4000-8000-000000000001",
      "req-idem",
    );

    expect(opportunity.create).not.toHaveBeenCalled();
    expect(result.status).toBe("CONVERTED");
    expect(result.opportunityId).toBe("o0000000-0000-4000-8000-000000000001");
  });

  it("convert() falls back to the lead name when the company is blank", async () => {
    const access = createBusinessAccessMock();
    const { database, opportunity } = createDatabaseMock(
      leadRecord({ name: "Dana Prospect", company: "   " }),
    );
    const service = new LeadsService(database, access);

    await service.convert(
      ACCESS.userPublicId,
      ACCESS.businessPublicId,
      "l0000000-0000-4000-8000-000000000001",
      "req-blank-company",
    );

    expect(opportunity.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: "Dana Prospect" }) }),
    );
  });

  it("convert() creates no second opportunity when a concurrent request won the transition", async () => {
    const access = createBusinessAccessMock();
    const { database, lead, opportunity } = createDatabaseMock(leadRecord({ status: "NEW" }));
    // The lead passes the initial not-yet-converted read, but the atomic
    // transition matches zero rows because a concurrent request converted it
    // first; the loser must return the winner's opportunity, not a duplicate.
    await opportunity.create({ data: { leadId: 900n } });
    opportunity.create.mockClear();
    lead.updateMany.mockResolvedValueOnce({ count: 0 });
    const service = new LeadsService(database, access);

    const result = await service.convert(
      ACCESS.userPublicId,
      ACCESS.businessPublicId,
      "l0000000-0000-4000-8000-000000000001",
      "req-concurrent",
    );

    expect(opportunity.create).not.toHaveBeenCalled();
    expect(result.opportunityId).toBe("o0000000-0000-4000-8000-000000000001");
  });
});
