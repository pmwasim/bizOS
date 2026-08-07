import { Plus, FileText } from "lucide-react";
import Link from "next/link";

import { salesOrderStatusLabel, type SalesOrder } from "@bizo/contracts/sales-orders";

import { apiJson } from "@/lib/api";
import { formatMinor } from "@/lib/display";

export default async function SalesOrdersPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const salesOrders = await apiJson<SalesOrder[]>(`/businesses/${businessId}/sales-orders`);
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Sales Orders</h1>
          <p>Confirmed customer orders ready for fulfilment.</p>
        </div>
        <Link className="button button-primary" href={`/b/${businessId}/sales-orders/new`}>
          <Plus aria-hidden="true" size={18} /> New sales order
        </Link>
      </header>
      {salesOrders.length ? (
        <div className="data-list">
          {salesOrders.map((order) => (
            <div className="data-row" key={order.id}>
              <span className="avatar">{order.number.slice(0, 1)}</span>
              <span className="grow">
                <strong>{order.number}</strong>
                <small>
                  {order.customer.name} &middot; {salesOrderStatusLabel(order.status)} &middot;{" "}
                  {formatMinor(order.totalMinor, order.currencyScale, order.currencyCode)}
                </small>
              </span>
              <Link className="text-link" href={`/b/${businessId}/sales-orders/${order.id}`}>
                View
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <FileText aria-hidden="true" size={30} />
          <h2>No sales orders yet</h2>
          <p>Create a sales order when a quotation is accepted.</p>
        </div>
      )}
    </div>
  );
}
