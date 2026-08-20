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

  it("allows members to create purchase orders but not change approval", async () => {
    const service = new BusinessAccessService({} as DatabaseService);
    const member = { ...ownerAccess, role: RoleCode.MEMBER };

    await expect(
      service.assertAllowed(member, "purchase_orders", "create"),
    ).resolves.toBeUndefined();
    await expect(service.assertAllowed(member, "approvals", "update")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("allows members to send invoices but not archive them", async () => {
    const service = new BusinessAccessService({} as DatabaseService);
    const member = { ...ownerAccess, role: RoleCode.MEMBER };

    await expect(service.assertAllowed(member, "invoices", "send")).resolves.toBeUndefined();
    await expect(service.assertAllowed(member, "invoices", "archive")).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.assertAllowed(ownerAccess, "invoices", "archive"),
    ).resolves.toBeUndefined();
  });

  it("keeps accountant and external-auditor access read-only", async () => {
    const service = new BusinessAccessService({} as DatabaseService);

    for (const role of [RoleCode.ACCOUNTANT, RoleCode.EXTERNAL_AUDITOR]) {
      const access = { ...ownerAccess, role };
      await expect(service.assertAllowed(access, "invoices", "read")).resolves.toBeUndefined();
      await expect(service.assertAllowed(access, "invoices", "update")).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(service.assertAllowed(access, "quotations", "send")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    }
  });

  it("reserves payment completion and reversal for owner and admin roles", async () => {
    const service = new BusinessAccessService({} as DatabaseService);

    for (const role of [RoleCode.OWNER, RoleCode.ADMIN]) {
      const access = { ...ownerAccess, role };
      await expect(service.assertAllowed(access, "payments", "complete")).resolves.toBeUndefined();
      await expect(service.assertAllowed(access, "payments", "reverse")).resolves.toBeUndefined();
    }

    for (const role of [RoleCode.MEMBER, RoleCode.STAFF, RoleCode.ACCOUNTANT]) {
      const access = { ...ownerAccess, role };
      await expect(service.assertAllowed(access, "payments", "complete")).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(service.assertAllowed(access, "payments", "reverse")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    }
  });

  it("lets staff work on operational records without finance administration", async () => {
    const service = new BusinessAccessService({} as DatabaseService);
    const staff = { ...ownerAccess, role: RoleCode.STAFF };

    await expect(service.assertAllowed(staff, "quotations", "create")).resolves.toBeUndefined();
    await expect(service.assertAllowed(staff, "invoices", "read")).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.assertAllowed(staff, "business", "update")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("lets read-only finance roles export statements but not email them", async () => {
    const service = new BusinessAccessService({} as DatabaseService);

    // Read-only finance roles can export the statement PDF but must not be able to send mail.
    for (const role of [RoleCode.ACCOUNTANT, RoleCode.EXTERNAL_AUDITOR]) {
      const access = { ...ownerAccess, role };
      await expect(service.assertAllowed(access, "payments", "export")).resolves.toBeUndefined();
      await expect(service.assertAllowed(access, "payments", "send")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    }

    // Send-capable roles can email statements.
    for (const role of [RoleCode.OWNER, RoleCode.ADMIN, RoleCode.MEMBER, RoleCode.STAFF]) {
      const access = { ...ownerAccess, role };
      await expect(service.assertAllowed(access, "payments", "send")).resolves.toBeUndefined();
      await expect(service.assertAllowed(access, "payments", "export")).resolves.toBeUndefined();
    }
  });

  it("reserves webhook management for owner and admin roles", async () => {
    const service = new BusinessAccessService({} as DatabaseService);

    for (const role of [RoleCode.OWNER, RoleCode.ADMIN]) {
      const access = { ...ownerAccess, role };
      await expect(service.assertAllowed(access, "webhooks", "create")).resolves.toBeUndefined();
      await expect(service.assertAllowed(access, "webhooks", "read")).resolves.toBeUndefined();
      await expect(service.assertAllowed(access, "webhooks", "update")).resolves.toBeUndefined();
    }

    for (const role of [
      RoleCode.MEMBER,
      RoleCode.STAFF,
      RoleCode.ACCOUNTANT,
      RoleCode.EXTERNAL_AUDITOR,
    ]) {
      const access = { ...ownerAccess, role };
      await expect(service.assertAllowed(access, "webhooks", "read")).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(service.assertAllowed(access, "webhooks", "create")).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(service.assertAllowed(access, "webhooks", "update")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    }
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
