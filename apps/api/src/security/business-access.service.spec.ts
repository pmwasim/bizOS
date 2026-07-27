import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { RoleCode } from "@bizo/database";

import { type DatabaseService } from "../database/database.service.js";
import { BusinessAccessService } from "./business-access.service.js";

const ownerAccess = {
  businessId: 11n,
  businessPublicId: "60d73986-e757-4629-9e20-d6f851e58b02",
  membershipId: 13n,
  role: RoleCode.OWNER,
  tenantId: 17n,
  tenantPublicId: "3cd6c286-3efe-4990-8dbf-ca9c06c3e423",
  userId: 19n,
  userPublicId: "9dc31c21-87e7-4aa5-a1ac-648ebc812028",
};

describe("BusinessAccessService", () => {
  it("allows an owner to update business settings", async () => {
    const service = new BusinessAccessService({} as DatabaseService);

    await expect(service.assertAllowed(ownerAccess, "business", "update")).resolves.toBeUndefined();
  });

  it("denies a team member from updating business settings", async () => {
    const service = new BusinessAccessService({} as DatabaseService);

    await expect(
      service.assertAllowed({ ...ownerAccess, role: RoleCode.MEMBER }, "business", "update"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("resolves access only through an active membership and the requested business", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      business: {
        id: ownerAccess.businessId,
        publicId: ownerAccess.businessPublicId,
        tenant: { publicId: ownerAccess.tenantPublicId },
      },
      membership: {
        id: ownerAccess.membershipId,
        user: { id: ownerAccess.userId, publicId: ownerAccess.userPublicId },
      },
      role: { code: RoleCode.OWNER },
      tenantId: ownerAccess.tenantId,
    });
    const database = {
      client: { businessAccess: { findFirst } },
    } as unknown as DatabaseService;
    const service = new BusinessAccessService(database);

    await expect(
      service.resolve(ownerAccess.userPublicId, ownerAccess.businessPublicId),
    ).resolves.toEqual(ownerAccess);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          business: { publicId: ownerAccess.businessPublicId },
          membership: expect.objectContaining({
            user: { publicId: ownerAccess.userPublicId },
          }),
        }),
      }),
    );
  });
});
