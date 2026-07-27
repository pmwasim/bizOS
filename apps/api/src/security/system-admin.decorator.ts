// Phase 9 — @SystemAdmin() decorator.
//
// Marks an endpoint (or controller) as requiring an ACTIVE PlatformSystemAdmin
// principal. The SystemAdminGuard reads this metadata and rejects requests
// whose principal has no active system admin row.
//
// This is a SEPARATE authorization boundary from BusinessAccessService
// (tenant-scoped) and from organization Owner/Admin. Organization admins
// cannot reach @SystemAdmin endpoints.

import { SetMetadata } from "@nestjs/common";

export const SYSTEM_ADMIN_ROUTE = "bizo.system-admin-route";

export const SystemAdmin = (): MethodDecorator & ClassDecorator =>
  SetMetadata(SYSTEM_ADMIN_ROUTE, true);
