import { Plus, PackageCheck } from "lucide-react";
import Link from "next/link";

import { type GoodsReceiptNote } from "@bizo/contracts/supplier-bills";

import { apiJson } from "@/lib/api";

export default async function GrnsPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const grns = await apiJson<GoodsReceiptNote[]>(`/businesses/${businessId}/procurement/grn`);
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Goods Receipt Notes</h1>
          <p>Record goods and services received from suppliers.</p>
        </div>
        <Link className="button button-primary" href={`/b/${businessId}/procurement/grn/new`}>
          <Plus aria-hidden="true" size={18} /> New GRN
        </Link>
      </header>
      {grns.length ? (
        <div className="data-list">
          {grns.map((grn) => (
            <div className="data-row" key={grn.id}>
              <span className="avatar">{grn.number.slice(0, 1)}</span>
              <span className="grow">
                <strong>{grn.number}</strong>
                <small>
                  {grn.supplier.name} &middot; {grn.status}
                </small>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <PackageCheck aria-hidden="true" size={30} />
          <h2>No GRNs yet</h2>
          <p>Track goods received against supplier POs.</p>
        </div>
      )}
    </div>
  );
}
