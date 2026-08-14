import Link from "next/link";

import { type SalesOrder, salesOrderStatusLabel } from "@bizo/contracts/sales-orders";

import { apiJson } from "@/lib/api";
import { formatMinor } from "@/lib/display";

export default async function SalesOrderDetailPage({
  params,
}: {
  params: Promise<{ businessId: string; salesOrderId: string }>;
}) {
  const { businessId, salesOrderId } = await params;
  const order = await apiJson<SalesOrder>(`/businesses/${businessId}/sales-orders/${salesOrderId}`);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>{order.number}</h1>
          <p>
            {order.customer.name} &middot; {salesOrderStatusLabel(order.status)}
          </p>
        </div>
        <div className="header-actions">
          <Link
            className="button button-quiet"
            href={`/b/${businessId}/delivery-notes/new?customer=${order.customer.id}`}
          >
            Create delivery
          </Link>
        </div>
      </header>
      <div className="card">
        <h2>Order details</h2>
        <dl className="detail-list">
          <div>
            <dt>Customer</dt>
            <dd>{order.customer.name}</dd>
          </div>
          <div>
            <dt>Issue date</dt>
            <dd>{order.issueDate}</dd>
          </div>
          {order.deliveryDate && (
            <div>
              <dt>Delivery date</dt>
              <dd>{order.deliveryDate}</dd>
            </div>
          )}
          <div>
            <dt>Total</dt>
            <dd>{formatMinor(order.totalMinor, order.currencyScale, order.currencyCode)}</dd>
          </div>
        </dl>
      </div>
      <div className="card">
        <h2>Line items</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Qty</th>
              <th>Unit price</th>
              <th>Tax</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line) => (
              <tr key={line.position}>
                <td>{line.description}</td>
                <td>{line.quantity}</td>
                <td>{formatMinor(line.unitPriceMinor, order.currencyScale, order.currencyCode)}</td>
                <td>{line.taxRatePpm / 10000}%</td>
                <td>{formatMinor(line.totalMinor, order.currencyScale, order.currencyCode)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {order.notes && (
        <div className="card">
          <h2>Notes</h2>
          <p>{order.notes}</p>
        </div>
      )}
    </div>
  );
}
