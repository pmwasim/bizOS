import { Plus, Building } from "lucide-react";
import Link from "next/link";

import { type Supplier } from "@bizo/contracts/suppliers";

import { apiJson } from "@/lib/api";

export default async function SuppliersPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const suppliers = await apiJson<Supplier[]>(`/businesses/${businessId}/suppliers`);
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Suppliers</h1>
          <p>Companies and vendors you purchase from.</p>
        </div>
        <Link className="button button-primary" href={`/b/${businessId}/suppliers/new`}>
          <Plus aria-hidden="true" size={18} /> Add supplier
        </Link>
      </header>
      {suppliers.length ? (
        <div className="data-list">
          {suppliers.map((supplier) => (
            <div className="data-row" key={supplier.id}>
              <span className="avatar">{supplier.name.slice(0, 1).toUpperCase()}</span>
              <span className="grow">
                <strong>{supplier.name}</strong>
                <small>{supplier.email ?? supplier.phone ?? "No contact yet"}</small>
              </span>
              <Link className="text-link" href={`/b/${businessId}/suppliers/${supplier.id}`}>
                View
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Building aria-hidden="true" size={30} />
          <h2>Add your first supplier</h2>
          <p>Track vendors for purchasing and procurement.</p>
        </div>
      )}
    </div>
  );
}
