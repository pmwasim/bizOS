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
  | "suppliers"
  | "quotations"
  | "sales_orders"
  | "delivery_notes"
  | "credit_notes"
  | "purchase_orders"
  | "approvals"
  | "invoices"
  | "payments"
  | "crm"
  | "projects"
  | "inventory";

export type AuthorizationAction =
  | "archive"
  | "complete"
  | "create"
  | "export"
  | "read"
  | "refund"
  | "reverse"
  | "send"
  | "update"
  | "upload"
  | "upload_evidence"
  | "void";

const ROLE_PERMISSIONS: Record<RoleCode, readonly string[]> = {
  OWNER: [
    "business:read",
    "business:update",
    "customers:create",
    "customers:read",
    "customers:update",
    "suppliers:create",
    "suppliers:read",
    "suppliers:update",
    "quotations:create",
    "quotations:read",
    "quotations:update",
    "quotations:export",
    "quotations:send",
    "sales_orders:create",
    "sales_orders:read",
    "sales_orders:update",
    "delivery_notes:create",
    "delivery_notes:read",
    "delivery_notes:update",
    "credit_notes:create",
    "credit_notes:read",
    "credit_notes:update",
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
    "payments:export",
    "payments:send",
    "payments:complete",
    "payments:reverse",
    "payments:void",
    "payments:refund",
    "crm:create",
    "crm:read",
    "crm:update",
    "projects:create",
    "projects:read",
    "projects:update",
    "inventory:create",
    "inventory:read",
    "inventory:update",
  ],
  ADMIN: [
    "business:read",
    "business:update",
    "customers:create",
    "customers:read",
    "customers:update",
    "suppliers:create",
    "suppliers:read",
    "suppliers:update",
    "quotations:create",
    "quotations:read",
    "quotations:update",
    "quotations:export",
    "quotations:send",
    "sales_orders:create",
    "sales_orders:read",
    "sales_orders:update",
    "delivery_notes:create",
    "delivery_notes:read",
    "delivery_notes:update",
    "credit_notes:create",
    "credit_notes:read",
    "credit_notes:update",
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
    "payments:export",
    "payments:send",
    "payments:complete",
    "payments:reverse",
    "payments:void",
    "payments:refund",
    "crm:create",
    "crm:read",
    "crm:update",
    "projects:create",
    "projects:read",
    "projects:update",
    "inventory:create",
    "inventory:read",
    "inventory:update",
  ],
  MEMBER: [
    "business:read",
    "customers:create",
    "customers:read",
    "customers:update",
    "suppliers:read",
    "quotations:create",
    "quotations:read",
    "quotations:update",
    "quotations:export",
    "quotations:send",
    "sales_orders:create",
    "sales_orders:read",
    "sales_orders:update",
    "delivery_notes:create",
    "delivery_notes:read",
    "delivery_notes:update",
    "credit_notes:create",
    "credit_notes:read",
    "credit_notes:update",
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
    "payments:export",
    "payments:send",
    "crm:create",
    "crm:read",
    "crm:update",
    "projects:create",
    "projects:read",
    "projects:update",
    "inventory:create",
    "inventory:read",
    "inventory:update",
  ],
  STAFF: [
    "business:read",
    "customers:create",
    "customers:read",
    "customers:update",
    "suppliers:read",
    "quotations:create",
    "quotations:read",
    "quotations:update",
    "quotations:export",
    "quotations:send",
    "sales_orders:create",
    "sales_orders:read",
    "sales_orders:update",
    "delivery_notes:create",
    "delivery_notes:read",
    "delivery_notes:update",
    "purchase_orders:create",
    "purchase_orders:read",
    "purchase_orders:update",
    "purchase_orders:upload",
    "payments:create",
    "payments:read",
    "payments:update",
    "payments:export",
    "payments:send",
    "crm:create",
    "crm:read",
    "crm:update",
    "projects:read",
    "inventory:read",
  ],
  ACCOUNTANT: [
    "business:read",
    "customers:read",
    "suppliers:read",
    "quotations:read",
    "quotations:export",
    "sales_orders:read",
    "delivery_notes:read",
    "credit_notes:read",
    "purchase_orders:read",
    "approvals:read",
    "invoices:read",
    "invoices:export",
    "payments:read",
    "payments:export",
    "crm:read",
    "projects:read",
    "inventory:read",
  ],
  EXTERNAL_AUDITOR: [
    "business:read",
    "customers:read",
    "suppliers:read",
    "quotations:read",
    "quotations:export",
    "sales_orders:read",
    "delivery_notes:read",
    "credit_notes:read",
    "purchase_orders:read",
    "approvals:read",
    "invoices:read",
    "invoices:export",
    "payments:read",
    "payments:export",
    "crm:read",
    "projects:read",
    "inventory:read",
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
    let allowed: boolean;
    try {
      allowed = await authorize(enforcer, {
        action,
        businessId: access.businessPublicId,
        object,
        subjectId: subject,
        tenantId: access.tenantPublicId,
      });
    } catch {
      allowed = false;
    }

    if (!allowed) {
      throw new NotFoundException("We could not find that resource.");
    }
  }
}
