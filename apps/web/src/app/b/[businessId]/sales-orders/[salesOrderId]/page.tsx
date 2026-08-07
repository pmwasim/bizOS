import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import { salesOrderStatusLabel, type SalesOrder } from "@bizo/contracts/sales-orders";

import { apiJson } from "@/lib/api";
import { formatMinor } from "@/lib/display";
import { SalesOrderActions } from "@/components/sales-order-actions";

export default async function SalesOrderDetailPage({
  params,
}: {
  params: Promise<{ businessId: string; salesOrderId: string }>;
}) {
  const { businessId, salesOrderId } = await params;
  const salesOrder = await apiJson<SalesOrder>(
    `/businesses/${businessId}/sales-orders/${salesOrderId}`,
  );

  return (
    <div className="page preview-page">
      <div className="preview-toolbar">
        <Link className="back-link" href={`/b/${businessId}/sales-orders`}>
          <ChevronLeft aria-hidden="true" size={18} /> Sales Orders
        </Link>
      </div>

      <header className="preview-title">
        <div>
          <span className={`status status-${salesOrder.status.toLowerCase()}`}>
            {salesOrderStatusLabel(salesOrder.status)}
          </span>
          <h1>{salesOrder.number}</h1>
          <p>{salesOrder.customer.name}</p>
        </div>
      </header>

      <section className="panel readiness-panel">
        <dl className="detail-grid">
          <div>
            <dt>Issue date</dt>
            <dd>{salesOrder.issueDate}</dd>
          </div>
          <div>
            <dt>Delivery date</dt>
            <dd>{salesOrder.deliveryDate || "Not scheduled"}</dd>
          </div>
          <div>
            <dt>Total</dt>
            <dd>
              {formatMinor(
                salesOrder.totalMinor,
                salesOrder.currencyScale,
                salesOrder.currencyCode,
              )}
            </dd>
          </div>
          <div>
            <dt>Notes</dt>
            <dd>{salesOrder.notes || "None"}</dd>
          </div>
        </dl>
      </section>

      <section className="panel" style={{ marginTop: "1rem" }}>
        <h2>Line items</h2>
        <table className="data-table" style={{ width: "100%", marginTop: "0.5rem" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Description</th>
              <th style={{ textAlign: "right" }}>Qty</th>
              <th style={{ textAlign: "right" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {salesOrder.lines.map((line) => (
              <tr key={line.position}>
                <td>{line.description}</td>
                <td style={{ textAlign: "right" }}>{line.quantity}</td>
                <td style={{ textAlign: "right" }}>
                  {formatMinor(line.totalMinor, salesOrder.currencyScale, salesOrder.currencyCode)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <SalesOrderActions
        businessId={businessId}
        salesOrderId={salesOrderId}
        status={salesOrder.status}
      />
    </div>
  );
}
