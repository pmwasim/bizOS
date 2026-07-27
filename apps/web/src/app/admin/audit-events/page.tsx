import { type SystemAdminAuditEventPage } from "@bizo/contracts/system-admin";

import { apiJson } from "@/lib/api";

export default async function AdminAuditEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ entityType?: string; businessPublicId?: string; page?: string }>;
}) {
  const query = await searchParams;
  const params = new URLSearchParams({ pageSize: "50" });
  if (query.entityType) params.set("entityType", query.entityType);
  if (query.businessPublicId) params.set("businessPublicId", query.businessPublicId);
  if (query.page) params.set("page", query.page);

  const events = await apiJson<SystemAdminAuditEventPage>(
    `/system-admin/audit-events?${params.toString()}`,
  );

  return (
    <div className="page">
      <header className="page-heading">
        <h1>Audit Events</h1>
        <p>Configuration changes recorded across the platform.</p>
      </header>

      <form className="admin-search" method="get">
        <label htmlFor="entityType">Entity type</label>
        <input
          id="entityType"
          name="entityType"
          type="text"
          defaultValue={query.entityType ?? ""}
          placeholder="BusinessConfigurationAssignment"
        />
        <label htmlFor="businessPublicId">Business ID</label>
        <input
          id="businessPublicId"
          name="businessPublicId"
          type="text"
          defaultValue={query.businessPublicId ?? ""}
          placeholder="UUID"
        />
        <button type="submit">Filter</button>
      </form>

      {events.items.length === 0 ? (
        <p className="admin-empty">No audit events match those filters.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Action</th>
              <th>Entity</th>
              <th>Actor</th>
              <th>Reason</th>
              <th>At</th>
            </tr>
          </thead>
          <tbody>
            {events.items.map((event) => (
              <tr key={event.id}>
                <td>{event.action}</td>
                <td>
                  <strong>{event.entityType}</strong>
                  <br />
                  <small>{event.entityId}</small>
                </td>
                <td>
                  {event.actorSystemAdminId ? (
                    <span>System Admin</span>
                  ) : event.actorMembershipId ? (
                    <span>Membership</span>
                  ) : (
                    <span>—</span>
                  )}
                </td>
                <td>{event.reason ?? "—"}</td>
                <td>{new Date(event.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="admin-pagination">
        <small>
          Page {events.page} of {Math.max(1, Math.ceil(events.total / events.pageSize))} ·{" "}
          {events.total} total
        </small>
      </p>
    </div>
  );
}
