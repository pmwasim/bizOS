import { BadRequestException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { type DatabaseService } from "../database/database.service.js";
import { type BusinessAccessService } from "../security/business-access.service.js";
import { CrmActivitiesService } from "./activities.service.js";

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

function createDatabaseMock(
  options: {
    customer?: { id: bigint } | null;
    opportunity?: { id: bigint } | null;
    lead?: { id: bigint } | null;
    rows?: unknown[];
  } = {},
) {
  const created: Array<Record<string, unknown>> = [];
  const crmActivity = {
    create: vi.fn().mockImplementation(async (args: { data: Record<string, unknown> }) => {
      created.push(args.data);
      return {
        publicId: "a0000000-0000-4000-8000-000000000001",
        type: args.data.type,
        subject: args.data.subject,
        body: args.data.body ?? null,
        occurredAt: args.data.occurredAt,
        customer: args.data.customerId ? { publicId: "c-1" } : null,
        opportunity: args.data.opportunityId ? { publicId: "o-1" } : null,
        lead: args.data.leadId ? { publicId: "l-1" } : null,
        createdAt: new Date("2026-08-29T00:00:00.000Z"),
      };
    }),
    findMany: vi.fn().mockResolvedValue(options.rows ?? []),
  };
  const customer = { findFirst: vi.fn().mockResolvedValue(options.customer ?? null) };
  const opportunity = { findFirst: vi.fn().mockResolvedValue(options.opportunity ?? null) };
  const lead = { findFirst: vi.fn().mockResolvedValue(options.lead ?? null) };
  const transaction = { crmActivity, customer, opportunity, lead };
  const database = {
    withScope: vi
      .fn()
      .mockImplementation(async (_access: unknown, work: (scope: typeof transaction) => unknown) =>
        work(transaction),
      ),
  };
  return {
    database: database as unknown as DatabaseService,
    crmActivity,
    customer,
    opportunity,
    lead,
    created,
  };
}

describe("CrmActivitiesService", () => {
  it("appends a note against a customer with the actor and a default occurredAt", async () => {
    const access = createBusinessAccessMock();
    const mock = createDatabaseMock({ customer: { id: 77n } });
    const service = new CrmActivitiesService(mock.database, access);

    const result = await service.create(ACCESS.userPublicId, ACCESS.businessPublicId, {
      type: "NOTE",
      subject: "Called about renewal",
      customerId: "c0000000-0000-4000-8000-000000000001",
    });

    expect(access.assertAllowed).toHaveBeenCalledWith(ACCESS, "crm", "create");
    expect(mock.crmActivity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "NOTE",
          subject: "Called about renewal",
          customerId: 77n,
          opportunityId: null,
          leadId: null,
          actorMembershipId: 300n,
        }),
      }),
    );
    // occurredAt defaults to a Date when the caller omits it.
    expect((mock.created[0] as { occurredAt: unknown }).occurredAt).toBeInstanceOf(Date);
    expect(result.type).toBe("NOTE");
    expect(result.customerId).toBe("c-1");
  });

  it("honours an explicit occurredAt and resolves an opportunity target", async () => {
    const access = createBusinessAccessMock();
    const mock = createDatabaseMock({ opportunity: { id: 900n } });
    const service = new CrmActivitiesService(mock.database, access);

    await service.create(ACCESS.userPublicId, ACCESS.businessPublicId, {
      type: "CALL",
      subject: "Discovery call",
      occurredAt: "2026-08-20T10:00:00.000Z",
      opportunityId: "o0000000-0000-4000-8000-000000000001",
    });

    expect(mock.crmActivity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          opportunityId: 900n,
          occurredAt: new Date("2026-08-20T10:00:00.000Z"),
        }),
      }),
    );
  });

  it("throws NotFoundException when the referenced customer is outside the business", async () => {
    const access = createBusinessAccessMock();
    const mock = createDatabaseMock({ customer: null });
    const service = new CrmActivitiesService(mock.database, access);

    await expect(
      service.create(ACCESS.userPublicId, ACCESS.businessPublicId, {
        type: "NOTE",
        subject: "x",
        customerId: "c0000000-0000-4000-8000-000000000099",
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(mock.crmActivity.create).not.toHaveBeenCalled();
  });

  it("rejects an activity that resolves to no target", async () => {
    const access = createBusinessAccessMock();
    const mock = createDatabaseMock();
    const service = new CrmActivitiesService(mock.database, access);

    await expect(
      // The contract normally blocks this; the service guards defensively too.
      service.create(ACCESS.userPublicId, ACCESS.businessPublicId, {
        type: "NOTE",
        subject: "orphan",
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("lists a customer's timeline most-recent-first via the scoped filter", async () => {
    const access = createBusinessAccessMock();
    const mock = createDatabaseMock({
      customer: { id: 77n },
      rows: [
        {
          publicId: "a-2",
          type: "CALL",
          subject: "later",
          body: null,
          occurredAt: new Date("2026-08-22T00:00:00.000Z"),
          customer: { publicId: "c-1" },
          opportunity: null,
          lead: null,
          createdAt: new Date("2026-08-22T00:00:00.000Z"),
        },
      ],
    });
    const service = new CrmActivitiesService(mock.database, access);

    const result = await service.list(ACCESS.userPublicId, ACCESS.businessPublicId, {
      customerPublicId: "c0000000-0000-4000-8000-000000000001",
    });

    expect(mock.crmActivity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ businessId: 44n, customerId: 77n }),
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.subject).toBe("later");
  });
});
