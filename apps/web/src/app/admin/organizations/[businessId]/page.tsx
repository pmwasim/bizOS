import Link from "next/link";

import {
  type SystemAdminOrganizationDetail,
  type SystemAdminAssignmentHistoryItem,
} from "@bizo/contracts/system-admin";

import { apiJson } from "@/lib/api";

export default async function AdminOrganizationDetailPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const [detail, history] = await Promise.all([
    apiJson<SystemAdminOrganizationDetail>(`/system-admin/organizations/${businessId}`),
    apiJson<SystemAdminAssignmentHistoryItem[]>(
      `/system-admin/organizations/${businessId}/assignments`,
    ),
  ]);

  return (
    <div className="page">
      <header className="page-heading">
        <p className="admin-breadcrumb">
          <Link href="/admin/organizations">Organizations</Link>
        </p>
        <h1>{detail.name}</h1>
        <p>
          {detail.legalName ?? detail.name} · {detail.countryCode} · {detail.baseCurrency}
        </p>
      </header>

      <section className="admin-section">
        <h2>Current configuration</h2>
        {detail.currentAssignment ? (
          <dl className="admin-detail-grid">
            <div>
              <dt>Template</dt>
              <dd>{detail.currentAssignment.templateCode}</dd>
            </div>
            <div>
              <dt>Version</dt>
              <dd>{detail.currentAssignment.templateVersion}</dd>
            </div>
            <div>
              <dt>Assigned at</dt>
              <dd>{new Date(detail.currentAssignment.assignedAt).toLocaleString()}</dd>
            </div>
          </dl>
        ) : (
          <p className="admin-empty">No primary configuration assigned.</p>
        )}
        <p className="admin-section-action">
          <Link href={`/admin/organizations/${businessId}/assignment`}>
            Change configuration assignment
          </Link>
        </p>
      </section>

      <section className="admin-section">
        <h2>Enabled modules</h2>
        {detail.enabledModules.length === 0 ? (
          <p className="admin-empty">No implemented modules enabled for this organization.</p>
        ) : (
          <ul className="admin-list">
            {detail.enabledModules.map((module) => (
              <li key={module.code}>
                <strong>{module.name}</strong>
                <small>
                  {module.code} · {module.status}
                </small>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="admin-section">
        <h2>Assignment history</h2>
        {history.length === 0 ? (
          <p className="admin-empty">No assignment history.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Template</th>
                <th>Version</th>
                <th>Primary</th>
                <th>Reason</th>
                <th>Assigned at</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id}>
                  <td>{item.templateCode}</td>
                  <td>{item.templateVersion}</td>
                  <td>{item.isPrimary ? "Yes" : "No"}</td>
                  <td>{item.reason ?? "—"}</td>
                  <td>{new Date(item.assignedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
