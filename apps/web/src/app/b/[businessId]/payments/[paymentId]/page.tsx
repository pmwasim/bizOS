import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import { type Payment, paymentStatusLabel } from "@bizo/contracts/payments";

import { apiJson } from "@/lib/api";
import { formatMoney } from "@/lib/display";

export default async function PaymentDetailPage({
  params,
}: {
  params: Promise<{ businessId: string; paymentId: string }>;
}) {
  const { businessId, paymentId } = await params;
  const payment = await apiJson<Payment>(`/businesses/${businessId}/payments/${paymentId}`);

  return (
    <div className="page preview-page">
      <div className="preview-toolbar">
        <Link className="back-link" href={`/b/${businessId}/payments`}>
          <ChevronLeft aria-hidden="true" size={18} /> Payments
        </Link>
      </div>

      <header className="preview-title">
        <div>
          <span className={`status status-${payment.status.toLowerCase()}`}>
            {paymentStatusLabel(payment.status)}
          </span>
          <h1>{payment.type === "INBOUND" ? "Payment Received" : "Payment Sent"}</h1>
          <p>{formatMoney(payment.amountMinor, payment.currencyCode, payment.currencyScale)}</p>
        </div>
      </header>

      <section className="panel readiness-panel">
        <dl className="detail-grid">
          <div>
            <dt>Date</dt>
            <dd>{payment.paymentDate}</dd>
          </div>
          <div>
            <dt>Reference</dt>
            <dd>{payment.reference || "None"}</dd>
          </div>
          <div>
            <dt>Notes</dt>
            <dd>{payment.notes || "None"}</dd>
          </div>
        </dl>
      </section>

      {payment.allocations.length > 0 && (
        <section className="panel" style={{ marginTop: "1rem" }}>
          <h2>Allocations</h2>
          <table className="data-table" style={{ width: "100%", marginTop: "0.5rem" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Document / PO</th>
                <th style={{ textAlign: "right" }}>Amount Allocated</th>
              </tr>
            </thead>
            <tbody>
              {payment.allocations.map((alloc) => (
                <tr key={alloc.id}>
                  <td>
                    {alloc.documentId ? (
                      <Link href={`/b/${businessId}/invoices/${alloc.documentId}`}>Invoice</Link>
                    ) : alloc.purchaseOrderId ? (
                      <Link href={`/b/${businessId}/purchase-orders/${alloc.purchaseOrderId}`}>
                        Purchase Order
                      </Link>
                    ) : (
                      "Unassigned"
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {formatMoney(alloc.amountMinor, payment.currencyCode, payment.currencyScale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
