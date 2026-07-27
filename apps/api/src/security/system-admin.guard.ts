// Phase 9 — SystemAdminGuard.
//
// A NestJS guard that checks the authenticated principal's user has an
// ACTIVE PlatformSystemAdmin row. Rejects with 403 (Forbidden) otherwise.
//
// This is a SEPARATE authorization boundary from BusinessAccessService
// (tenant-scoped) and from organization Owner/Admin. Organization admins
// cannot reach @SystemAdmin endpoints even if they happen to know the URL.
//
// The guard is applied per-controller via @UseGuards(SystemAdminGuard) so it
// runs after the global InternalAuthGuard (which sets request.principal).
// On success it augments request.principal with the systemAdminId and
// isSystemAdmin=true so downstream services can attribute audit events.

import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import { type Request } from "express";

import { PlatformSystemAdminStatus } from "@bizo/database";

import { DatabaseService } from "../database/database.service.js";
import { type AuthenticatedPrincipal } from "./principal.js";

type PrincipalRequest = Request & { principal?: AuthenticatedPrincipal };

@Injectable()
export class SystemAdminGuard implements CanActivate {
  private readonly logger = new Logger(SystemAdminGuard.name);

  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<PrincipalRequest>();
    const principal = request.principal;
    if (!principal) {
      // InternalAuthGuard runs first and sets request.principal. If we get
      // here without one, the route is misconfigured (e.g. @Public + @SystemAdmin).
      throw new ForbiddenException("System Admin access is required.");
    }

    const record = await this.database.client.platformSystemAdmin.findFirst({
      where: { user: { publicId: principal.userId } },
      select: { id: true, publicId: true, status: true },
    });

    if (!record || record.status !== PlatformSystemAdminStatus.ACTIVE) {
      this.logger.warn(
        `Denied system-admin access for user ${principal.userId}: ${
          record ? `status=${record.status}` : "no PlatformSystemAdmin row"
        }`,
      );
      throw new ForbiddenException("You do not have System Admin access.");
    }

    request.principal = {
      ...principal,
      systemAdminId: record.publicId,
      isSystemAdmin: true,
    };
    return true;
  }
}
