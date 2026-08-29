import { BadRequestException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { type Quotation } from "@bizo/contracts/quotations";

import { type DatabaseService } from "../database/database.service.js";
import { type QuotationsService } from "../documents/quotations.service.js";
import { type BusinessAccessService } from "../security/business-access.service.js";
import { OpportunitiesService } from "./opportunities.service.js";

function createQuotationsMock(overrides: Partial<Quotation> = {}): {
  service: QuotationsService;
  create: ReturnType<typeof vi.fn>;
} {
  const create = vi.fn().mockImplementation(
    async (): Promise<Quotation> =>
      ({
        id: "q0000000-0000-4000-8000-000000000001",
        number: "Q-0001",
        ...overrides,
      }) as Quotation,
  );
  return { service: { create } as unknown as QuotationsService, create };
}

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
  const crmActivity = {
    create: vi.fn().mockResolvedValue({}),
  };
  const transaction = { lead, opportunity, auditEvent, crmActivity };
  const database = {
    withScope: vi
      .fn()
      .mockImplementation(async (_access: unknown, work: (scope: typeof transaction) => unknown) =>
        work(transaction),
      ),
  };
  return {
    database: database as unknown as DatabaseService,
    opportunity,
    crmActivity,
    auditEvents,
  };
}

describe("OpportunitiesService", () => {
  it("creates an opportunity with a default stage and no lead", async () => {
    const access = createBusinessAccessMock();
    const { database, opportunity, auditEvents } = createDatabaseMock();
    const service = new OpportunitiesService(database, access, createQuotationsMock().service);

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
    const service = new OpportunitiesService(database, access, createQuotationsMock().service);

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
    const serviceWithMissingLead = new OpportunitiesService(
      missingLeadDb.database,
      access,
      createQuotationsMock().service,
    );
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
    const service = new OpportunitiesService(database, access, createQuotationsMock().service);

    await expect(
      service.get(ACCESS.userPublicId, ACCESS.businessPublicId, "missing"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("update() only overwrites fields explicitly present in the request", async () => {
    const access = createBusinessAccessMock();
    const { database, opportunity, crmActivity } = createDatabaseMock(
      opportunityRecord({ probability: 20, notes: "keep me" }),
    );
    const service = new OpportunitiesService(database, access, createQuotationsMock().service);

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
    // Changing the stage records a STAGE_CHANGE entry on the activity timeline.
    expect(crmActivity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "STAGE_CHANGE",
          opportunityId: 900n,
        }),
      }),
    );
  });

  it("update() does not record a stage-change activity when the stage is unchanged", async () => {
    const access = createBusinessAccessMock();
    const { database, crmActivity } = createDatabaseMock(
      opportunityRecord({ stage: "PROSPECTING" }),
    );
    const service = new OpportunitiesService(database, access, createQuotationsMock().service);

    await service.update(
      ACCESS.userPublicId,
      ACCESS.businessPublicId,
      "o0000000-0000-4000-8000-000000000001",
      { notes: "just a note" },
      "req-4b",
    );

    expect(crmActivity.create).not.toHaveBeenCalled();
  });

  it("maps the linked quotation record onto the public `quotation` field", async () => {
    const access = createBusinessAccessMock();
    const { database } = createDatabaseMock(
      opportunityRecord({
        quotation: { publicId: "q0000000-0000-4000-8000-000000000001", number: "Q-0001" },
      }),
    );
    const service = new OpportunitiesService(database, access, createQuotationsMock().service);

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

// ---------------------------------------------------------------------------
// convertToQuotation
// ---------------------------------------------------------------------------

const LEAD = {
  publicId: "l0000000-0000-4000-8000-000000000001",
  name: "Ada Lovelace",
  company: "Analytical Engines Ltd",
  email: "ada@engines.example",
  phone: "+441234567890",
};

function decimalMinor(value: string) {
  return { toFixed: () => value, toString: () => value } as unknown;
}

function convertRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 900n,
    publicId: "o0000000-0000-4000-8000-000000000001",
    name: "Website Revamp Deal",
    stage: "PROSPECTING",
    probability: null,
    amountMinor: decimalMinor("50000"),
    currencyCode: "USD",
    expectedCloseDate: null,
    actualCloseDate: null,
    notes: null,
    lead: { ...LEAD } as {
      publicId: string;
      name: string;
      company: string | null;
      email: string | null;
      phone: string | null;
    } | null,
    quotation: null as { publicId: string; number: string } | null,
    createdAt: new Date("2026-08-07T00:00:00.000Z"),
    updatedAt: new Date("2026-08-07T00:00:00.000Z"),
    ...overrides,
  };
}

function createConvertDatabaseMock(
  initial: ReturnType<typeof convertRecord>,
  options: {
    existingCustomer?: { publicId: string } | null;
    ratePpm?: number | null;
    enabled?: boolean;
    baseCurrency?: string;
    configured?: boolean;
    linkCount?: number;
    priorQuotation?: { id: bigint; publicId: string } | null;
  } = {},
) {
  let row = initial;
  const auditEvents: unknown[] = [];
  const opportunity = {
    findFirst: vi.fn().mockImplementation(async () => row),
    updateMany: vi.fn().mockImplementation(async () => {
      const count = options.linkCount ?? (row.quotation ? 0 : 1);
      if (count > 0 && !row.quotation) {
        row = {
          ...row,
          quotation: { publicId: "q0000000-0000-4000-8000-000000000001", number: "Q-0001" },
        };
      }
      return { count };
    }),
  };
  const customer = {
    findFirst: vi.fn().mockResolvedValue(options.existingCustomer ?? null),
    create: vi.fn().mockResolvedValue({ publicId: "c0000000-0000-4000-8000-000000000009" }),
  };
  const taxProfile = {
    findFirst: vi
      .fn()
      .mockResolvedValue(
        options.ratePpm === null
          ? null
          : { ratePpm: options.ratePpm ?? 150_000, enabled: options.enabled ?? true },
      ),
  };
  const business = {
    findUniqueOrThrow: vi.fn().mockResolvedValue({
      baseCurrency: options.baseCurrency ?? "USD",
      currencyScale: 2,
      settings: options.configured === false ? null : { id: 1n },
      taxProfile: options.configured === false ? null : { id: 1n },
    }),
  };
  const document = {
    findFirst: vi.fn().mockResolvedValue(options.priorQuotation ?? null),
    findFirstOrThrow: vi.fn().mockResolvedValue({ id: 7000n }),
  };
  const auditEvent = {
    create: vi.fn().mockImplementation(async (args: { data: unknown }) => {
      auditEvents.push(args.data);
      return args.data;
    }),
  };
  const transaction = { opportunity, customer, taxProfile, document, auditEvent, business };
  const database = {
    withScope: vi
      .fn()
      .mockImplementation(async (_access: unknown, work: (scope: typeof transaction) => unknown) =>
        work(transaction),
      ),
  };
  return {
    database: database as unknown as DatabaseService,
    opportunity,
    customer,
    taxProfile,
    business,
    auditEvents,
    setRow: (next: ReturnType<typeof convertRecord>) => {
      row = next;
    },
  };
}

describe("OpportunitiesService.convertToQuotation", () => {
  it("auto-seeds a customer and a single line from the opportunity and links the quotation", async () => {
    const access = createBusinessAccessMock();
    const mock = createConvertDatabaseMock(convertRecord());
    const quotations = createQuotationsMock();
    const service = new OpportunitiesService(mock.database, access, quotations.service);

    const result = await service.convertToQuotation(
      ACCESS.userPublicId,
      ACCESS.businessPublicId,
      "o0000000-0000-4000-8000-000000000001",
      {},
      "req-convert-1",
    );

    expect(access.assertAllowed).toHaveBeenCalledWith(ACCESS, "crm", "update");
    // No existing customer matched on email → a customer is seeded from the lead.
    expect(mock.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Analytical Engines Ltd",
          email: "ada@engines.example",
          phone: "+441234567890",
        }),
      }),
    );
    // The reused engine is called with the seeded customer + a single line.
    expect(quotations.create).toHaveBeenCalledWith(
      ACCESS.userPublicId,
      ACCESS.businessPublicId,
      {
        customerId: "c0000000-0000-4000-8000-000000000009",
        lines: [
          {
            description: "Website Revamp Deal",
            // 50000 minor units at currency scale 2 = 500.00 major units — NOT
            // "50000" (that would be quoted 100x too high once the engine scales).
            unitPrice: "500.00",
            quantity: "1",
            taxRatePercent: "15",
          },
        ],
      },
      "req-convert-1",
      { sourceOpportunityId: 900n },
    );
    // The opportunity is linked atomically (only while quotationId IS NULL).
    expect(mock.opportunity.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 900n, quotationId: null },
        data: { quotationId: 7000n },
      }),
    );
    // Response is a superset of the opportunity plus the created quotation id.
    expect(result.quotationId).toBe("q0000000-0000-4000-8000-000000000001");
    expect(result.quotation).toEqual({
      id: "q0000000-0000-4000-8000-000000000001",
      number: "Q-0001",
    });
    expect(result.name).toBe("Website Revamp Deal");
    expect(mock.auditEvents).toHaveLength(1);
  });

  it("reuses an existing customer matched by the lead email", async () => {
    const access = createBusinessAccessMock();
    const mock = createConvertDatabaseMock(convertRecord(), {
      existingCustomer: { publicId: "c0000000-0000-4000-8000-000000000001" },
    });
    const quotations = createQuotationsMock();
    const service = new OpportunitiesService(mock.database, access, quotations.service);

    await service.convertToQuotation(
      ACCESS.userPublicId,
      ACCESS.businessPublicId,
      "o0000000-0000-4000-8000-000000000001",
      {},
      "req-convert-2",
    );

    expect(mock.customer.create).not.toHaveBeenCalled();
    expect(quotations.create).toHaveBeenCalledWith(
      ACCESS.userPublicId,
      ACCESS.businessPublicId,
      expect.objectContaining({ customerId: "c0000000-0000-4000-8000-000000000001" }),
      "req-convert-2",
      { sourceOpportunityId: 900n },
    );
  });

  it("honours explicit customerId and lines overrides without seeding", async () => {
    const access = createBusinessAccessMock();
    const mock = createConvertDatabaseMock(convertRecord({ lead: null, amountMinor: null }));
    const quotations = createQuotationsMock();
    const service = new OpportunitiesService(mock.database, access, quotations.service);

    await service.convertToQuotation(
      ACCESS.userPublicId,
      ACCESS.businessPublicId,
      "o0000000-0000-4000-8000-000000000001",
      {
        customerId: "c0000000-0000-4000-8000-000000000123",
        lines: [{ description: "Bespoke", quantity: "2", unitPrice: "1000", taxRatePercent: "0" }],
      },
      "req-convert-3",
    );

    expect(mock.customer.findFirst).not.toHaveBeenCalled();
    expect(mock.customer.create).not.toHaveBeenCalled();
    expect(quotations.create).toHaveBeenCalledWith(
      ACCESS.userPublicId,
      ACCESS.businessPublicId,
      {
        customerId: "c0000000-0000-4000-8000-000000000123",
        lines: [{ description: "Bespoke", quantity: "2", unitPrice: "1000", taxRatePercent: "0" }],
      },
      "req-convert-3",
      { sourceOpportunityId: 900n },
    );
  });

  it("is idempotent: an already-linked opportunity returns the existing quotation and creates no second one", async () => {
    const access = createBusinessAccessMock();
    const mock = createConvertDatabaseMock(
      convertRecord({
        quotation: { publicId: "q0000000-0000-4000-8000-000000000777", number: "Q-0777" },
      }),
    );
    const quotations = createQuotationsMock();
    const service = new OpportunitiesService(mock.database, access, quotations.service);

    const result = await service.convertToQuotation(
      ACCESS.userPublicId,
      ACCESS.businessPublicId,
      "o0000000-0000-4000-8000-000000000001",
      {},
      "req-convert-4",
    );

    expect(quotations.create).not.toHaveBeenCalled();
    expect(mock.opportunity.updateMany).not.toHaveBeenCalled();
    expect(result.quotationId).toBe("q0000000-0000-4000-8000-000000000777");
    expect(result.quotation).toEqual({
      id: "q0000000-0000-4000-8000-000000000777",
      number: "Q-0777",
    });
  });

  it("recovers a prior committed-but-unlinked quotation on retry instead of creating a duplicate", async () => {
    const access = createBusinessAccessMock();
    // A previous attempt committed the quotation (stamped with the back-ref) but
    // failed to link it. The retry finds it and links it, calling the engine 0×.
    const mock = createConvertDatabaseMock(convertRecord(), {
      priorQuotation: { id: 8100n, publicId: "q0000000-0000-4000-8000-000000000888" },
    });
    mock.opportunity.findFirst.mockResolvedValueOnce(convertRecord()).mockResolvedValue(
      convertRecord({
        quotation: { publicId: "q0000000-0000-4000-8000-000000000888", number: "Q-0888" },
      }),
    );
    const quotations = createQuotationsMock();
    const service = new OpportunitiesService(mock.database, access, quotations.service);

    const result = await service.convertToQuotation(
      ACCESS.userPublicId,
      ACCESS.businessPublicId,
      "o0000000-0000-4000-8000-000000000001",
      {},
      "req-convert-recover",
    );

    expect(quotations.create).not.toHaveBeenCalled();
    expect(mock.opportunity.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 900n, quotationId: null },
        data: { quotationId: 8100n },
      }),
    );
    expect(result.quotationId).toBe("q0000000-0000-4000-8000-000000000888");
  });

  it("returns the existing link and does not double-link when a concurrent conversion wins the race", async () => {
    const access = createBusinessAccessMock();
    // The guard matches zero rows (a concurrent winner already linked); the
    // re-read then surfaces the winner's quotation.
    const mock = createConvertDatabaseMock(convertRecord(), { linkCount: 0 });
    mock.opportunity.findFirst.mockResolvedValueOnce(convertRecord()).mockResolvedValue(
      convertRecord({
        quotation: { publicId: "q0000000-0000-4000-8000-000000000555", number: "Q-0555" },
      }),
    );
    const quotations = createQuotationsMock();
    const service = new OpportunitiesService(mock.database, access, quotations.service);

    const result = await service.convertToQuotation(
      ACCESS.userPublicId,
      ACCESS.businessPublicId,
      "o0000000-0000-4000-8000-000000000001",
      {},
      "req-convert-5",
    );

    expect(result.quotationId).toBe("q0000000-0000-4000-8000-000000000555");
    // No audit event for a link that did not happen here.
    expect(mock.auditEvents).toHaveLength(0);
  });

  it("rejects with 400 when there is no lead and no customerId override", async () => {
    const access = createBusinessAccessMock();
    const mock = createConvertDatabaseMock(convertRecord({ lead: null }));
    const quotations = createQuotationsMock();
    const service = new OpportunitiesService(mock.database, access, quotations.service);

    await expect(
      service.convertToQuotation(
        ACCESS.userPublicId,
        ACCESS.businessPublicId,
        "o0000000-0000-4000-8000-000000000001",
        {},
        "req-convert-6",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(quotations.create).not.toHaveBeenCalled();
  });

  it("rejects with 400 when the amount is null and no lines override is provided", async () => {
    const access = createBusinessAccessMock();
    const mock = createConvertDatabaseMock(convertRecord({ amountMinor: null }));
    const quotations = createQuotationsMock();
    const service = new OpportunitiesService(mock.database, access, quotations.service);

    await expect(
      service.convertToQuotation(
        ACCESS.userPublicId,
        ACCESS.businessPublicId,
        "o0000000-0000-4000-8000-000000000001",
        {},
        "req-convert-7",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(quotations.create).not.toHaveBeenCalled();
  });

  it("rejects the auto-seed path when the opportunity currency is not the base currency", async () => {
    const access = createBusinessAccessMock();
    const mock = createConvertDatabaseMock(convertRecord({ currencyCode: "EUR" }), {
      baseCurrency: "USD",
    });
    const quotations = createQuotationsMock();
    const service = new OpportunitiesService(mock.database, access, quotations.service);

    await expect(
      service.convertToQuotation(
        ACCESS.userPublicId,
        ACCESS.businessPublicId,
        "o0000000-0000-4000-8000-000000000001",
        {},
        "req-convert-8",
      ),
    ).rejects.toMatchObject({ response: { code: "OPPORTUNITY_CURRENCY_MISMATCH" } });
    expect(quotations.create).not.toHaveBeenCalled();
    // The customer is resolved LAST, so a rejected conversion leaves no orphan.
    expect(mock.customer.create).not.toHaveBeenCalled();
  });

  it("adds no tax when the business tax profile is disabled", async () => {
    const access = createBusinessAccessMock();
    const mock = createConvertDatabaseMock(convertRecord(), { ratePpm: 150_000, enabled: false });
    const quotations = createQuotationsMock();
    const service = new OpportunitiesService(mock.database, access, quotations.service);

    await service.convertToQuotation(
      ACCESS.userPublicId,
      ACCESS.businessPublicId,
      "o0000000-0000-4000-8000-000000000001",
      {},
      "req-convert-9",
    );

    expect(quotations.create).toHaveBeenCalledWith(
      ACCESS.userPublicId,
      ACCESS.businessPublicId,
      expect.objectContaining({
        lines: [expect.objectContaining({ taxRatePercent: "0" })],
      }),
      "req-convert-9",
      { sourceOpportunityId: 900n },
    );
  });

  it("rejects before touching the customer when the business is not configured", async () => {
    const access = createBusinessAccessMock();
    const mock = createConvertDatabaseMock(convertRecord(), { configured: false });
    const quotations = createQuotationsMock();
    const service = new OpportunitiesService(mock.database, access, quotations.service);

    await expect(
      service.convertToQuotation(
        ACCESS.userPublicId,
        ACCESS.businessPublicId,
        "o0000000-0000-4000-8000-000000000001",
        {},
        "req-convert-10",
      ),
    ).rejects.toMatchObject({ response: { code: "BUSINESS_NOT_CONFIGURED" } });
    expect(mock.customer.create).not.toHaveBeenCalled();
    expect(quotations.create).not.toHaveBeenCalled();
  });
});
