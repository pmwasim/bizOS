import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import { type Supplier } from "@bizo/contracts/suppliers";

import { apiJson } from "@/lib/api";
import { SupplierActions } from "@/components/supplier-actions";

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ businessId: string; supplierId: string }>;
}) {
  const { businessId, supplierId } = await params;
  const supplier = await apiJson<Supplier>(`/businesses/${businessId}/suppliers/${supplierId}`);

  return (
    <div className="page preview-page">
      <div className="preview-toolbar">
        <Link className="back-link" href={`/b/${businessId}/suppliers`}>
          <ChevronLeft aria-hidden="true" size={18} /> Suppliers
        </Link>
      </div>

      <header className="preview-title">
        <div>
          <span className={`status status-${supplier.isActive ? "active" : "inactive"}`}>
            {supplier.isActive ? "Active" : "Inactive"}
          </span>
          <h1>{supplier.name}</h1>
          {supplier.contactName ? <p>{supplier.contactName}</p> : null}
        </div>
      </header>

      <section className="panel readiness-panel">
        <dl className="detail-grid">
          <div>
            <dt>Email</dt>
            <dd>{supplier.email || "None"}</dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd>{supplier.phone || "None"}</dd>
          </div>
          <div>
            <dt>Tax ID</dt>
            <dd>{supplier.taxId || "None"}</dd>
          </div>
          <div>
            <dt>Payment terms</dt>
            <dd>{supplier.paymentTerms ? `${supplier.paymentTerms} days` : "None"}</dd>
          </div>
          <div>
            <dt>Bank</dt>
            <dd>{supplier.bankName || "None"}</dd>
          </div>
          <div>
            <dt>Notes</dt>
            <dd>{supplier.notes || "None"}</dd>
          </div>
        </dl>
      </section>

      {supplier.isActive ? (
        <SupplierActions businessId={businessId} supplierId={supplierId} />
      ) : null}
    </div>
  );
}
