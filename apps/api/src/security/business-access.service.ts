import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import { authorize, createAuthorizationEnforcer } from "@bizo/authorization";
import { MembershipStatus, type RoleCode } from "@bizo/database";

import { DatabaseService } from "../database/database.service.js";

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

export type AuthorizationObject =
  | "business"
  | "customers"
  | "quotations"
  | "purchase_orders"
  | "approvals"
  | "invoices"
  | "payments";

export type AuthorizationAction =
  "archive" | "create" | "export" | "read" | "send" | "update" | "upload" | "upload_evidence";

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
    "purchase_orders:create",
    "purchase_orders:read",
    "purchase_orders:update",
    "purchase_orders:archive",
    "purchase_orders:upload",
    "approvals:read",
    "approvals:update",
    "approvals:upload_evidence",
    "invoices:create",
    "invoices:read",
    "invoices:update",
    "invoices:export",
    "invoices:send",
    "invoices:archive",
    "payments:create",
    "payments:read",
    "payments:update",
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
    "purchase_orders:create",
    "purchase_orders:read",
    "purchase_orders:update",
    "purchase_orders:archive",
    "purchase_orders:upload",
    "approvals:read",
    "approvals:update",
    "approvals:upload_evidence",
    "invoices:create",
    "invoices:read",
    "invoices:update",
    "invoices:export",
    "invoices:send",
    "invoices:archive",
    "payments:create",
    "payments:read",
    "payments:update",
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
    "purchase_orders:create",
    "purchase_orders:read",
    "purchase_orders:update",
    "purchase_orders:upload",
    "approvals:read",
    "invoices:create",
    "invoices:read",
    "invoices:update",
    "invoices:export",
    "invoices:send",
    "payments:create",
    "payments:read",
    "payments:update",
  ],
  STAFF: [
    "business:read",
    "customers:create",
    "customers:read",
    "customers:update",
    "quotations:create",
    "quotations:read",
    "quotations:update",
    "quotations:export",
    "quotations:send",
    "purchase_orders:create",
    "purchase_orders:read",
    "purchase_orders:update",
    "purchase_orders:upload",
    "payments:create",
    "payments:read",
    "payments:update",
  ],
  ACCOUNTANT: [
    "business:read",
    "customers:read",
    "quotations:read",
    "quotations:export",
    "purchase_orders:read",
    "approvals:read",
    "invoices:read",
    "invoices:export",
    "payments:read",
  ],
  EXTERNAL_AUDITOR: [
    "business:read",
    "customers:read",
    "quotations:read",
    "quotations:export",
    "purchase_orders:read",
    "approvals:read",
    "invoices:read",
    "invoices:export",
    "payments:read",
  ],
};

@Injectable()
export class BusinessAccessService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

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
    object: AuthorizationObject,
    action: AuthorizationAction,
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
