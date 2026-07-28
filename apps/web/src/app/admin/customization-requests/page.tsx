import { type SystemAdminCustomizationRequestPage } from "@bizo/contracts/system-admin";

import { apiJson } from "@/lib/api";

export default async function AdminCustomizationRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const query = await searchParams;
  const params = new URLSearchParams({ pageSize: "50" });
  if (query.status) params.set("status", query.status);
  if (query.page) params.set("page", query.page);

  const requests = await apiJson<SystemAdminCustomizationRequestPage>(
    `/system-admin/customization-requests?${params.toString()}`,
  );

  return (
    <div className="page">
      <header className="page-heading">
        <h1>Customization Requests</h1>
        <p>Organizations requesting specialized configuration templates.</p>
      </header>

      <form className="admin-search" method="get">
        <label htmlFor="status">Status</label>
        <select id="status" name="status" defaultValue={query.status ?? ""}>
          <option value="">All</option>
          <option value="OPEN">Open</option>
          <option value="IN_REVIEW">In review</option>
          <option value="RESOLVED">Resolved</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <button type="submit">Filter</button>
      </form>

      {requests.items.length === 0 ? (
        <p className="admin-empty">No customization requests match that filter.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Request</th>
              <th>Business</th>
              <th>Urgency</th>
              <th>Status</th>
              <th>Consent</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {requests.items.map((request) => (
              <tr key={request.id}>
                <td>
                  <strong>{request.id.slice(0, 8)}</strong>
                </td>
                <td>
                  <small>{request.businessId}</small>
                </td>
                <td>{request.urgency}</td>
                <td>{request.status}</td>
                <td>{request.consentToReview ? "Yes" : "No"}</td>
                <td>{new Date(request.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="admin-pagination">
        <small>
          Page {requests.page} of {Math.max(1, Math.ceil(requests.total / requests.pageSize))} ·{" "}
          {requests.total} total
        </small>
      </p>
    </div>
  );
}
