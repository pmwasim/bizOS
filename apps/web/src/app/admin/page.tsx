import Link from "next/link";

import {
  type SystemAdminHealthSummary,
  type SystemAdminOrganizationPage,
  type SystemAdminCustomizationRequestPage,
} from "@bizo/contracts/system-admin";

import { apiJson } from "@/lib/api";

export default async function AdminDashboardPage() {
  const [health, organizations, customizationRequests] = await Promise.all([
    apiJson<SystemAdminHealthSummary>("/system-admin/health"),
    apiJson<SystemAdminOrganizationPage>("/system-admin/organizations?page=1&pageSize=5"),
    apiJson<SystemAdminCustomizationRequestPage>(
      "/system-admin/customization-requests?page=1&pageSize=5",
    ),
  ]);

  return (
    <div className="page">
      <header className="page-heading">
        <h1>System Admin Dashboard</h1>
        <p>Platform-wide configuration health and recent activity.</p>
      </header>

      <section className="admin-tile-grid">
        <div className="admin-tile">
          <span className="admin-tile-label">API status</span>
          <strong className={`admin-tile-value admin-status-${health.status}`}>
            {health.status.toUpperCase()}
          </strong>
          <small>Checked at {new Date(health.timestamp).toLocaleString()}</small>
        </div>
        <div className="admin-tile">
          <span className="admin-tile-label">Organizations</span>
          <strong className="admin-tile-value">{organizations.total}</strong>
          <small>Total businesses on the platform</small>
        </div>
        <div className="admin-tile">
          <span className="admin-tile-label">Open customization requests</span>
          <strong className="admin-tile-value">{customizationRequests.total}</strong>
          <small>Awaiting review</small>
        </div>
      </section>

      <section className="admin-section">
        <h2>Recent organizations</h2>
        {organizations.items.length === 0 ? (
          <p className="admin-empty">No organizations yet.</p>
        ) : (
          <ul className="admin-list">
            {organizations.items.map((org) => (
              <li key={org.businessId}>
                <Link href={`/admin/organizations/${org.businessId}`}>
                  <strong>{org.name}</strong>
                  <small>
                    {org.countryCode} · {org.baseCurrency} ·{" "}
                    {org.currentAssignment
                      ? `${org.currentAssignment.templateCode} v${org.currentAssignment.templateVersion}`
                      : "No configuration"}
                  </small>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="admin-section-action">
          <Link href="/admin/organizations">View all organizations</Link>
        </p>
      </section>
    </div>
  );
}
