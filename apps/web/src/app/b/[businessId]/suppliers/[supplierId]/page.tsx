import Link from "next/link";

import { type Supplier } from "@bizo/contracts/suppliers";

import { apiJson } from "@/lib/api";

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ businessId: string; supplierId: string }>;
}) {
  const { businessId, supplierId } = await params;
  const supplier = await apiJson<Supplier>(`/businesses/${businessId}/suppliers/${supplierId}`);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>{supplier.name}</h1>
          <p>{supplier.contactName ?? "No contact name"}</p>
        </div>
        <div className="header-actions">
          <Link className="button button-quiet" href={`/b/${businessId}/suppliers`}>
            Back to suppliers
          </Link>
        </div>
      </header>
      <div className="card">
        <h2>Contact details</h2>
        <dl className="detail-list">
          {supplier.email && (
            <div>
              <dt>Email</dt>
              <dd>{supplier.email}</dd>
            </div>
          )}
          {supplier.phone && (
            <div>
              <dt>Phone</dt>
              <dd>{supplier.phone}</dd>
            </div>
          )}
          {supplier.taxId && (
            <div>
              <dt>Tax ID</dt>
              <dd>{supplier.taxId}</dd>
            </div>
          )}
          {supplier.paymentTerms !== null && supplier.paymentTerms !== undefined && (
            <div>
              <dt>Payment terms</dt>
              <dd>{supplier.paymentTerms} days</dd>
            </div>
          )}
        </dl>
      </div>
      {(supplier.bankName || supplier.iban || supplier.swiftCode) && (
        <div className="card">
          <h2>Banking details</h2>
          <dl className="detail-list">
            {supplier.bankName && (
              <div>
                <dt>Bank</dt>
                <dd>{supplier.bankName}</dd>
              </div>
            )}
            {supplier.iban && (
              <div>
                <dt>IBAN</dt>
                <dd>{supplier.iban}</dd>
              </div>
            )}
            {supplier.swiftCode && (
              <div>
                <dt>SWIFT</dt>
                <dd>{supplier.swiftCode}</dd>
              </div>
            )}
          </dl>
        </div>
      )}
      {supplier.notes && (
        <div className="card">
          <h2>Notes</h2>
          <p>{supplier.notes}</p>
        </div>
      )}
    </div>
  );
}
