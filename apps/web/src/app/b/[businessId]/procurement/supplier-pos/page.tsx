import { Plus, FileText } from "lucide-react";
import Link from "next/link";

import { type SupplierPo } from "@bizo/contracts/supplier-pos";

import { apiJson } from "@/lib/api";
import { formatMinor } from "@/lib/display";

export default async function SupplierPosPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const pos = await apiJson<SupplierPo[]>(`/businesses/${businessId}/procurement/supplier-pos`);
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Supplier Purchase Orders</h1>
          <p>Outbound purchase orders issued to suppliers.</p>
        </div>
        <Link
          className="button button-primary"
          href={`/b/${businessId}/procurement/supplier-pos/new`}
        >
          <Plus aria-hidden="true" size={18} /> New supplier PO
        </Link>
      </header>
      {pos.length ? (
        <div className="data-list">
          {pos.map((po) => (
            <div className="data-row" key={po.id}>
              <span className="avatar">{po.number.slice(0, 1)}</span>
              <span className="grow">
                <strong>{po.number}</strong>
                <small>
                  {po.supplier.name} &middot; {po.status} &middot;{" "}
                  {formatMinor(po.totalMinor, po.currencyScale, po.currencyCode)}
                </small>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <FileText aria-hidden="true" size={30} />
          <h2>No supplier POs yet</h2>
          <p>Create a supplier PO to order goods or services.</p>
        </div>
      )}
    </div>
  );
}
