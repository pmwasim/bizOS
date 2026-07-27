import Link from "next/link";

import { type SystemAdminOrganizationPage } from "@bizo/contracts/system-admin";

import { apiJson } from "@/lib/api";

export default async function AdminOrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const query = await searchParams;
  const searchParam = query.search ? `&search=${encodeURIComponent(query.search)}` : "";
  const pageParam = query.page ? `&page=${encodeURIComponent(query.page)}` : "";
  const organizations = await apiJson<SystemAdminOrganizationPage>(
    `/system-admin/organizations?pageSize=20${searchParam}${pageParam}`,
  );

  return (
    <div className="page">
      <header className="page-heading">
        <h1>Organizations</h1>
        <p>Cross-tenant view of every business on the platform.</p>
      </header>

      <form className="admin-search" method="get">
        <label htmlFor="search">Search by name</label>
        <input
          id="search"
          name="search"
          type="search"
          defaultValue={query.search ?? ""}
          placeholder="Acme"
        />
        <button type="submit">Search</button>
      </form>

      {organizations.items.length === 0 ? (
        <p className="admin-empty">No organizations match that search.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Country</th>
              <th>Currency</th>
              <th>Configuration</th>
              <th aria-label="Open" />
            </tr>
          </thead>
          <tbody>
            {organizations.items.map((org) => (
              <tr key={org.businessId}>
                <td>{org.name}</td>
                <td>{org.countryCode}</td>
                <td>
                  {org.baseCurrency} ({org.currencyScale})
                </td>
                <td>
                  {org.currentAssignment
                    ? `${org.currentAssignment.templateCode} v${org.currentAssignment.templateVersion}`
                    : "—"}
                </td>
                <td>
                  <Link href={`/admin/organizations/${org.businessId}`}>Open</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="admin-pagination">
        <small>
          Page {organizations.page} of{" "}
          {Math.max(1, Math.ceil(organizations.total / organizations.pageSize))} ·{" "}
          {organizations.total} total
        </small>
      </p>
    </div>
  );
}
