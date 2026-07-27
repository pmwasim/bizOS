import { notFound } from "next/navigation";

import { type EnabledModuleSummary } from "@bizo/contracts/configuration";
import { type SystemAdminPrincipal } from "@bizo/contracts/system-admin";

import { AppShell } from "@/components/app-shell";
import { apiJson } from "@/lib/api";
import { loadWorkspace } from "@/lib/workspace";

export default async function BusinessLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const workspace = await loadWorkspace();
  const business = workspace.businesses.find((item) => item.id === businessId);
  if (!business) notFound();

  let modules: EnabledModuleSummary[];
  try {
    modules = await apiJson<EnabledModuleSummary[]>(`/businesses/${businessId}/modules`);
  } catch {
    // If the modules endpoint is unavailable (e.g. during a transient error),
    // fall back to an empty nav. The user can still navigate via the dashboard.
    modules = [];
  }

  // Phase 9 — surface a System Admin link only to active System Admins. The
  // /system-admin/me endpoint returns 403 for non-admins, which we swallow.
  let isSystemAdmin: boolean;
  try {
    await apiJson<SystemAdminPrincipal>("/system-admin/me");
    isSystemAdmin = true;
  } catch {
    isSystemAdmin = false;
  }

  return (
    <AppShell
      businessId={business.id}
      businessName={business.name}
      modules={modules}
      isSystemAdmin={isSystemAdmin}
    >
      {children}
    </AppShell>
  );
}
