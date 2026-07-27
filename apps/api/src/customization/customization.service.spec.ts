import { BadRequestException, NotFoundException } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";

import { type ConfigurationService } from "../configuration/configuration.service.js";
import { type DatabaseService } from "../database/database.service.js";
import { type BusinessAccessService } from "../security/business-access.service.js";
import { CustomizationService } from "./customization.service.js";
import * as n8nNotifier from "./n8n-notifier.js";

const USER_PUBLIC_ID = "u0000000-0000-4000-8000-000000000001";
const BUSINESS_PUBLIC_ID = "b0000000-0000-4000-8000-000000000001";
const OTHER_BUSINESS_PUBLIC_ID = "b0000000-0000-4000-8000-000000000099";
const TENANT_PUBLIC_ID = "t0000000-0000-4000-8000-000000000001";
const MEMBERSHIP_PUBLIC_ID = "m0000000-0000-4000-8000-000000000001";
const VERSION_PUBLIC_ID = "v0000000-0000-4000-8000-000000000001";
const REQUEST_PUBLIC_ID = "r0000000-0000-4000-8000-000000000001";

const ACCESS = {
  businessId: 200n,
  businessPublicId: BUSINESS_PUBLIC_ID,
  membershipId: 300n,
  role: "OWNER" as const,
  tenantId: 100n,
  tenantPublicId: TENANT_PUBLIC_ID,
  userId: 1n,
  userPublicId: USER_PUBLIC_ID,
};

function createRequestRecord(overrides: Record<string, unknown> = {}) {
  return {
    publicId: REQUEST_PUBLIC_ID,
    statedProcessJson: { text: "Quote to invoice" },
    requestedChangesJson: { text: "Custom numbering" },
    notesJson: { text: "Call me" },
    urgency: "HIGH" as const,
    consentToReview: true,
    status: "OPEN" as const,
    createdAt: new Date("2026-07-28T00:00:00.000Z"),
    updatedAt: new Date("2026-07-28T00:00:00.000Z"),
    business: { publicId: BUSINESS_PUBLIC_ID },
    requesterMembership: { publicId: MEMBERSHIP_PUBLIC_ID },
    currentConfigurationTemplateVersion: { publicId: VERSION_PUBLIC_ID },
    ...overrides,
  };
}

function createBusinessAccessMock(): BusinessAccessService {
  return {
    resolve: vi.fn().mockResolvedValue(ACCESS),
    assertAllowed: vi.fn(),
  } as unknown as BusinessAccessService;
}

function createConfigurationMock(): ConfigurationService {
  return {
    getActiveAssignment: vi.fn().mockResolvedValue({
      id: "a0000000-0000-4000-8000-000000000001",
      businessId: BUSINESS_PUBLIC_ID,
      configurationTemplateVersionId: VERSION_PUBLIC_ID,
      templateCode: "default-erp",
      templateVersion: "1.0.0",
      isPrimary: true,
      assignedByMembershipId: null,
      reason: "auto-assign",
      assignedAt: "2026-07-28T00:00:00.000Z",
      snapshot: { modules: [], workflows: [] },
    }),
  } as unknown as ConfigurationService;
}

function createDatabaseMock() {
  const customizationRequest = {
    create: vi.fn().mockResolvedValue(createRequestRecord()),
    findFirst: vi.fn().mockResolvedValue(createRequestRecord()),
    findMany: vi.fn().mockResolvedValue([createRequestRecord()]),
  };
  const transaction = { customizationRequest };
  const configurationTemplateVersion = {
    findUnique: vi.fn().mockResolvedValue({ id: 900n, publicId: VERSION_PUBLIC_ID }),
  };

  const database = {
    client: {
      configurationTemplateVersion,
    },
    withScope: vi
      .fn()
      .mockImplementation(async (_access: unknown, work: (scope: typeof transaction) => unknown) =>
        work(transaction),
      ),
  };

  return { database: database as unknown as DatabaseService, customizationRequest };
}

describe("CustomizationService", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("creates a request with the active configuration version and requires consent", async () => {
    vi.spyOn(n8nNotifier, "notifyCustomizationRequestCreated").mockResolvedValue(undefined);
    const access = createBusinessAccessMock();
    const configuration = createConfigurationMock();
    const { database, customizationRequest } = createDatabaseMock();
    const service = new CustomizationService(database, access, configuration);

    const result = await service.createRequest({
      userPublicId: USER_PUBLIC_ID,
      businessPublicId: BUSINESS_PUBLIC_ID,
      statedProcess: "Quote to invoice",
      requestedChanges: "Custom numbering",
      urgency: "HIGH",
      notes: "Call me",
      consentToReview: true,
    });

    expect(customizationRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          currentConfigurationTemplateVersionId: 900n,
          statedProcessJson: { text: "Quote to invoice" },
          requestedChangesJson: { text: "Custom numbering" },
          notesJson: { text: "Call me" },
          consentToReview: true,
          status: "OPEN",
          requesterMembershipId: ACCESS.membershipId,
        }),
      }),
    );
    expect(result.currentConfigurationTemplateVersionId).toBe(VERSION_PUBLIC_ID);
    expect(result.status).toBe("OPEN");
    expect(n8nNotifier.notifyCustomizationRequestCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        id: REQUEST_PUBLIC_ID,
        businessId: BUSINESS_PUBLIC_ID,
        currentConfigurationTemplateVersionId: VERSION_PUBLIC_ID,
      }),
    );
  });

  it("rejects create when consent is missing", async () => {
    const service = new CustomizationService(
      createDatabaseMock().database,
      createBusinessAccessMock(),
      createConfigurationMock(),
    );

    await expect(
      service.createRequest({
        userPublicId: USER_PUBLIC_ID,
        businessPublicId: BUSINESS_PUBLIC_ID,
        statedProcess: "Process",
        requestedChanges: "Changes",
        urgency: "LOW",
        consentToReview: false as unknown as true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("lists requests for the resolved business", async () => {
    const access = createBusinessAccessMock();
    const { database, customizationRequest } = createDatabaseMock();
    const service = new CustomizationService(database, access, createConfigurationMock());

    const result = await service.listRequests({
      userPublicId: USER_PUBLIC_ID,
      businessPublicId: BUSINESS_PUBLIC_ID,
    });

    expect(customizationRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { businessId: ACCESS.businessId },
      }),
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe(REQUEST_PUBLIC_ID);
  });

  it("returns one request scoped to the business", async () => {
    const access = createBusinessAccessMock();
    const { database, customizationRequest } = createDatabaseMock();
    const service = new CustomizationService(database, access, createConfigurationMock());

    const result = await service.getRequest({
      userPublicId: USER_PUBLIC_ID,
      businessPublicId: BUSINESS_PUBLIC_ID,
      requestId: REQUEST_PUBLIC_ID,
    });

    expect(customizationRequest.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          publicId: REQUEST_PUBLIC_ID,
          businessId: ACCESS.businessId,
        },
      }),
    );
    expect(result.id).toBe(REQUEST_PUBLIC_ID);
  });

  it("denies cross-tenant access during resolve", async () => {
    const access = createBusinessAccessMock();
    access.resolve = vi
      .fn()
      .mockRejectedValue(new NotFoundException("We could not find that business."));
    const service = new CustomizationService(
      createDatabaseMock().database,
      access,
      createConfigurationMock(),
    );

    await expect(
      service.listRequests({
        userPublicId: USER_PUBLIC_ID,
        businessPublicId: OTHER_BUSINESS_PUBLIC_ID,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("continues create when n8n notification fails", async () => {
    vi.stubEnv("N8N_CUSTOMIZATION_WEBHOOK_URL", "https://n8n.example.test/customization");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("n8n unavailable")));
    const service = new CustomizationService(
      createDatabaseMock().database,
      createBusinessAccessMock(),
      createConfigurationMock(),
    );

    await expect(
      service.createRequest({
        userPublicId: USER_PUBLIC_ID,
        businessPublicId: BUSINESS_PUBLIC_ID,
        statedProcess: "Process",
        requestedChanges: "Changes",
        urgency: "MEDIUM",
        consentToReview: true,
      }),
    ).resolves.toMatchObject({ id: REQUEST_PUBLIC_ID });
  });
});
