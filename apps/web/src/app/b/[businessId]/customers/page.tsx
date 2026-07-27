import { Plus, Users } from "lucide-react";
import Link from "next/link";

import { type Customer } from "@bizo/contracts/customers";

import { apiJson } from "@/lib/api";

export default async function CustomersPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const customers = await apiJson<Customer[]>(`/businesses/${businessId}/customers`);
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Customers</h1>
          <p>People and companies you prepare quotations for.</p>
        </div>
        <Link className="button button-primary" href={`/b/${businessId}/customers/new`}>
          <Plus aria-hidden="true" size={18} /> Add customer
        </Link>
      </header>
      {customers.length ? (
        <div className="data-list">
          {customers.map((customer) => (
            <div className="data-row" key={customer.id}>
              <span className="avatar">{customer.name.slice(0, 1).toUpperCase()}</span>
              <span className="grow">
                <strong>{customer.name}</strong>
                <small>{customer.email ?? "No email yet"}</small>
              </span>
              <Link
                className="text-link"
                href={`/b/${businessId}/quotations/new?customer=${customer.id}`}
              >
                Create quotation
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Users aria-hidden="true" size={30} />
          <h2>Add your first customer</h2>
          <p>You only need a name to get started.</p>
        </div>
      )}
    </div>
  );
}
