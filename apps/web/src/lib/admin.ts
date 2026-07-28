import { redirect } from "next/navigation";

import { type SystemAdminPrincipal } from "@bizo/contracts/system-admin";

import { apiJson } from "@/lib/api";

// Phase 9 — System Admin portal authorization.
//
// Every admin page calls requireSystemAdmin() at the top. The /system-admin/me
// endpoint is guarded by SystemAdminGuard, so a 403 means the signed-in user
// has no ACTIVE PlatformSystemAdmin row. We surface that as a redirect to the
// home page so the portal is unreachable for regular org users even if they
// know the URL.

export async function requireSystemAdmin(): Promise<SystemAdminPrincipal> {
  try {
    return await apiJson<SystemAdminPrincipal>("/system-admin/me");
  } catch {
    redirect("/");
  }
}
