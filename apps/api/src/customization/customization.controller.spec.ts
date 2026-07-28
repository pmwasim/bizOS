import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import type { CustomizationService } from "./customization.service.js";
import { CustomizationController } from "./customization.controller.js";

const USER_PUBLIC_ID = "u0000000-0000-4000-8000-000000000001";
const BUSINESS_PUBLIC_ID = "b0000000-0000-4000-8000-000000000001";
const OTHER_BUSINESS_PUBLIC_ID = "b0000000-0000-4000-8000-000000000099";
const REQUEST_PUBLIC_ID = "r0000000-0000-4000-8000-000000000001";

const REQUEST_SUMMARY = {
  id: REQUEST_PUBLIC_ID,
  businessId: BUSINESS_PUBLIC_ID,
  requesterMembershipId: "m0000000-0000-4000-8000-000000000001",
  currentConfigurationTemplateVersionId: "v0000000-0000-4000-8000-000000000001",
  statedProcess: { text: "Quote to invoice" },
  requestedChanges: { text: "Custom numbering" },
  urgency: "HIGH" as const,
  notes: { text: "Call me" },
  consentToReview: true,
  status: "OPEN" as const,
  createdAt: "2026-07-28T00:00:00.000Z",
  updatedAt: "2026-07-28T00:00:00.000Z",
};

function createServiceMock(overrides: Partial<CustomizationService> = {}): CustomizationService {
  const mock = {
    createRequest: vi.fn().mockResolvedValue(REQUEST_SUMMARY),
    listRequests: vi.fn().mockResolvedValue({ items: [REQUEST_SUMMARY] }),
    getRequest: vi.fn().mockResolvedValue(REQUEST_SUMMARY),
  };
  return { ...mock, ...overrides } as unknown as CustomizationService;
}

describe("CustomizationController", () => {
  it("creates a request for POST /businesses/:businessId/customization-requests", async () => {
    const service = createServiceMock();
    const controller = new CustomizationController(service);

    const result = await controller.createRequest({ userId: USER_PUBLIC_ID }, BUSINESS_PUBLIC_ID, {
      statedProcess: "Quote to invoice",
      requestedChanges: "Custom numbering",
      urgency: "HIGH",
      notes: "Call me",
      consentToReview: true,
    });

    expect(result).toEqual(REQUEST_SUMMARY);
    expect(service.createRequest).toHaveBeenCalledWith({
      userPublicId: USER_PUBLIC_ID,
      businessPublicId: BUSINESS_PUBLIC_ID,
      statedProcess: "Quote to invoice",
      requestedChanges: "Custom numbering",
      urgency: "HIGH",
      notes: "Call me",
      consentToReview: true,
    });
  });

  it("lists requests for GET /businesses/:businessId/customization-requests", async () => {
    const service = createServiceMock();
    const controller = new CustomizationController(service);

    const result = await controller.listRequests({ userId: USER_PUBLIC_ID }, BUSINESS_PUBLIC_ID);

    expect(result.items).toEqual([REQUEST_SUMMARY]);
    expect(service.listRequests).toHaveBeenCalledWith({
      userPublicId: USER_PUBLIC_ID,
      businessPublicId: BUSINESS_PUBLIC_ID,
    });
  });

  it("gets one request for GET /businesses/:businessId/customization-requests/:requestId", async () => {
    const service = createServiceMock();
    const controller = new CustomizationController(service);

    const result = await controller.getRequest(
      { userId: USER_PUBLIC_ID },
      BUSINESS_PUBLIC_ID,
      REQUEST_PUBLIC_ID,
    );

    expect(result).toEqual(REQUEST_SUMMARY);
    expect(service.getRequest).toHaveBeenCalledWith({
      userPublicId: USER_PUBLIC_ID,
      businessPublicId: BUSINESS_PUBLIC_ID,
      requestId: REQUEST_PUBLIC_ID,
    });
  });

  it("propagates cross-tenant rejection from the service", async () => {
    const service = createServiceMock({
      listRequests: vi
        .fn()
        .mockRejectedValue(new NotFoundException("We could not find that business.")),
    });
    const controller = new CustomizationController(service);

    await expect(
      controller.listRequests({ userId: USER_PUBLIC_ID }, OTHER_BUSINESS_PUBLIC_ID),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
