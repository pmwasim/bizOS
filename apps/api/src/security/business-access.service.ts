import { Injectable, NotFoundException } from "@nestjs/common";

import { authorize, createAuthorizationEnforcer } from "@bizo/authorization";
import { MembershipStatus, type RoleCode } from "@bizo/database";

import { type DatabaseService } from "../database/database.service.js";

export interface BusinessAccessContext {
  businessId: bigint;
  businessPublicId: string;
  membershipId: bigint;
  role: RoleCode;
  tenantId: bigint;
  tenantPublicId: string;
  userId: bigint;
  userPublicId: string;
}

const ROLE_PERMISSIONS: Record<RoleCode, readonly string[]> = {
  OWNER: [
    "business:read",
    "business:update",
    "customers:create",
    "customers:read",
    "customers:update",
    "quotations:create",
    "quotations:read",
    "quotations:update",
    "quotations:export",
    "quotations:send",
  ],
  ADMIN: [
    "business:read",
    "business:update",
    "customers:create",
    "customers:read",
    "customers:update",
    "quotations:create",
    "quotations:read",
    "quotations:update",
    "quotations:export",
    "quotations:send",
  ],
  MEMBER: [
    "business:read",
    "customers:create",
    "customers:read",
    "customers:update",
    "quotations:create",
    "quotations:read",
    "quotations:update",
    "quotations:export",
    "quotations:send",
  ],
};

@Injectable()
export class BusinessAccessService {
  constructor(private readonly database: DatabaseService) {}

  async resolve(userPublicId: string, businessPublicId: string): Promise<BusinessAccessContext> {
    const record = await this.database.client.businessAccess.findFirst({
      where: {
        business: { publicId: businessPublicId },
        membership: {
          status: MembershipStatus.ACTIVE,
          user: { publicId: userPublicId },
        },
      },
      select: {
        business: {
          select: {
            id: true,
            publicId: true,
            tenant: { select: { publicId: true } },
          },
        },
        membership: {
          select: {
            id: true,
            user: { select: { id: true, publicId: true } },
          },
        },
        role: { select: { code: true } },
        tenantId: true,
      },
    });

    if (!record) {
      throw new NotFoundException("We could not find that business.");
    }

    return {
      businessId: record.business.id,
      businessPublicId: record.business.publicId,
      membershipId: record.membership.id,
      role: record.role.code,
      tenantId: record.tenantId,
      tenantPublicId: record.business.tenant.publicId,
      userId: record.membership.user.id,
      userPublicId: record.membership.user.publicId,
    };
  }

  async assertAllowed(
    access: BusinessAccessContext,
    object: "business" | "customers" | "quotations",
    action: "create" | "export" | "read" | "send" | "update",
  ): Promise<void> {
    const domain = `${access.tenantPublicId}:${access.businessPublicId}`;
    const subject = access.userPublicId;
    const rolePermissions = ROLE_PERMISSIONS[access.role];
    if (!rolePermissions) {
      throw new NotFoundException("We could not find that resource.");
    }
    const policyLines = rolePermissions.map((permission) => {
      const separator = permission.indexOf(":");
      const policyObject = permission.slice(0, separator);
      const policyAction = permission.slice(separator + 1);
      return `p, ${access.role}, ${domain}, ${policyObject}, ${policyAction}, allow`;
    });
    policyLines.push(`g, ${subject}, ${access.role}, ${domain}`);

    const enforcer = await createAuthorizationEnforcer(policyLines);
    const allowed = await authorize(enforcer, {
      action,
      businessId: access.businessPublicId,
      object,
      subjectId: subject,
      tenantId: access.tenantPublicId,
    });

    if (!allowed) {
      throw new NotFoundException("We could not find that resource.");
    }
  }
}
