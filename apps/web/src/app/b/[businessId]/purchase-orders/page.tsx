import { ClipboardList, Plus } from "lucide-react";
import Link from "next/link";

import { type PurchaseOrder } from "@bizo/contracts/purchase-orders";

import { apiJson } from "@/lib/api";

export default async function PurchaseOrdersPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const purchaseOrders = await apiJson<PurchaseOrder[]>(
    `/businesses/${businessId}/purchase-orders`,
  );

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Purchase orders</h1>
          <p>Record customer POs and track whether a job is ready to invoice.</p>
        </div>
        <Link className="button button-primary" href={`/b/${businessId}/purchase-orders/new`}>
          <Plus aria-hidden="true" size={18} /> Add purchase order
        </Link>
      </header>
      {purchaseOrders.length ? (
        <div className="data-list">
          {purchaseOrders.map((purchaseOrder) => (
            <Link
              className="data-row"
              href={`/b/${businessId}/purchase-orders/${purchaseOrder.id}`}
              key={purchaseOrder.id}
            >
              <span className="avatar">PO</span>
              <span className="grow">
                <strong>{purchaseOrder.poNumber}</strong>
                <small>
                  {purchaseOrder.customer.name}
                  {purchaseOrder.quotation ? ` · ${purchaseOrder.quotation.number}` : ""}
                </small>
              </span>
              <span className={`status readiness-${purchaseOrder.readiness.code.toLowerCase()}`}>
                {purchaseOrder.readiness.label}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <ClipboardList aria-hidden="true" size={30} />
          <h2>No purchase orders yet</h2>
          <p>Add a customer PO after a quotation is accepted.</p>
        </div>
      )}
    </div>
  );
}
