import {
  type SystemAdminConfigurationTemplateSummary,
  type SystemAdminAuditEventPage,
} from "@bizo/contracts/system-admin";

import { DefaultErpForm } from "@/components/admin-default-erp-form";
import { apiJson } from "@/lib/api";

export default async function AdminDefaultErpPage({
  searchParams,
}: {
  searchParams: Promise<{ set?: string }>;
}) {
  const query = await searchParams;
  const [templates, auditEvents] = await Promise.all([
    apiJson<SystemAdminConfigurationTemplateSummary[]>(
      "/system-admin/configuration-templates?templateCode=default-erp&status=PUBLISHED",
    ),
    apiJson<SystemAdminAuditEventPage>(
      "/system-admin/audit-events?entityType=PlatformDefaultErpVersion&pageSize=5",
    ),
  ]);

  return (
    <div className="page">
      <header className="page-heading">
        <h1>Platform Default ERP</h1>
        <p>
          The default ERP version used for new onboarding recommendations. Only published
          default-erp versions can be set as the platform default.
        </p>
      </header>

      {query.set === "1" ? (
        <p className="admin-success-banner" role="status">
          Platform default ERP version updated.
        </p>
      ) : null}

      <DefaultErpForm templates={templates} />

      <section className="admin-section">
        <h2>Recent default ERP changes</h2>
        {auditEvents.items.length === 0 ? (
          <p className="admin-empty">No default ERP changes recorded yet.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Reason</th>
                <th>At</th>
              </tr>
            </thead>
            <tbody>
              {auditEvents.items.map((event) => (
                <tr key={event.id}>
                  <td>{event.action}</td>
                  <td>{event.reason ?? "—"}</td>
                  <td>{new Date(event.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
