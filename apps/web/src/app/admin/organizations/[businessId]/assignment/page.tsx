import Link from "next/link";

import { type SystemAdminConfigurationTemplateSummary } from "@bizo/contracts/system-admin";

import { AssignmentForm } from "@/components/admin-assignment-form";
import { apiJson } from "@/lib/api";

export default async function AdminAssignmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ assigned?: string }>;
}) {
  const { businessId } = await params;
  const query = await searchParams;
  const templates = await apiJson<SystemAdminConfigurationTemplateSummary[]>(
    "/system-admin/configuration-templates?status=PUBLISHED",
  );

  return (
    <div className="page">
      <header className="page-heading">
        <p className="admin-breadcrumb">
          <Link href={`/admin/organizations/${businessId}`}>Organization</Link>
        </p>
        <h1>Change configuration assignment</h1>
        <p>
          This action demotes the current primary assignment and applies a new configuration
          immediately. The change is recorded in the audit log with your System Admin identity.
        </p>
      </header>

      {query.assigned === "1" ? (
        <p className="admin-success-banner" role="status">
          Assignment updated. The new configuration is now primary.
        </p>
      ) : null}

      <AssignmentForm businessId={businessId} templates={templates} />
    </div>
  );
}
