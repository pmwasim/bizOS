import { ArrowDownLeft, ArrowUpRight, ChevronLeft, Download } from "lucide-react";
import Link from "next/link";

import { type Payment, paymentStatusLabel } from "@bizo/contracts/payments";

import {
  MarkPaymentCompletedButton,
  RefundPaymentForm,
  ReversePaymentButton,
  VoidPaymentButton,
} from "@/components/payment-actions";
import { apiJson } from "@/lib/api";
import { formatMoney } from "@/lib/display";
import { loadWorkspace } from "@/lib/workspace";

/**
 * Roles holding `payments:void`, `payments:reverse`, and `payments:refund` in
 * `BusinessAccessService` — the same OWNER/ADMIN set.
 */
const ROLES_THAT_MAY_MANAGE = new Set(["OWNER", "ADMIN"]);

export default async function PaymentDetailPage({
  params,
}: {
  params: Promise<{ businessId: string; paymentId: string }>;
}) {
  const { businessId, paymentId } = await params;
  const [payment, workspace] = await Promise.all([
    apiJson<Payment>(`/businesses/${businessId}/payments/${paymentId}`),
    loadWorkspace(),
  ]);
  const role = workspace.businesses.find((business) => business.id === businessId)?.role;
  const mayManage = role !== undefined && ROLES_THAT_MAY_MANAGE.has(role);
  const pdfPath = `/api/businesses/${businessId}/payments/${paymentId}/pdf`;
  const hasRefunds = payment.refunds.length > 0;

  const canComplete = payment.status === "DRAFT";

  return (
    <div className="page preview-page">
      <div className="preview-toolbar">
        <Link className="back-link" href={`/b/${businessId}/payments`}>
          <ChevronLeft aria-hidden="true" size={18} /> Payments
        </Link>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          {canComplete && mayManage ? (
            <MarkPaymentCompletedButton businessId={businessId} paymentId={paymentId} />
          ) : null}
          <a className="button button-secondary" href={`${pdfPath}?download=1`}>
            <Download aria-hidden="true" size={17} /> Download receipt
          </a>
        </div>
      </div>

      <header className="preview-title">
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div
            style={{
              background: payment.type === "INBOUND" ? "var(--success-bg)" : "var(--muted)",
              color: payment.type === "INBOUND" ? "var(--success)" : "var(--foreground)",
              borderRadius: "50%",
              width: "40px",
              height: "40px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {payment.type === "INBOUND" ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
          </div>
          <div>
            <span className={`status status-${payment.status.toLowerCase()}`}>
              {paymentStatusLabel(payment.status)}
            </span>
            <h1>{payment.type === "INBOUND" ? "Payment Received" : "Payment Sent"}</h1>
            <p
              className="text-xl font-bold"
              style={{ marginTop: "0.25rem", color: "var(--foreground)" }}
            >
              {formatMoney(payment.amountMinor, payment.currencyCode, payment.currencyScale)}
            </p>
          </div>
        </div>
      </header>

      <section className="panel readiness-panel">
        <h2>Payment Details</h2>
        <dl className="detail-grid">
          <div>
            <dt>Date</dt>
            <dd>{payment.paymentDate}</dd>
          </div>
          <div>
            <dt>Direction</dt>
            <dd>{payment.type === "INBOUND" ? "Customer Receipt" : "Supplier Disbursement"}</dd>
          </div>
          <div>
            <dt>Reference #</dt>
            <dd>{payment.reference || "None"}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <span className={`status status-${payment.status.toLowerCase()}`}>
                {paymentStatusLabel(payment.status)}
              </span>
            </dd>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <dt>Notes</dt>
            <dd>{payment.notes || "No notes attached"}</dd>
          </div>
        </dl>
      </section>

      {payment.allocations.length > 0 ? (
        <section className="panel">
          <div className="section-heading">
            <h2>Allocations ({payment.allocations.length})</h2>
          </div>
          <div className="data-list">
            {payment.allocations.map((alloc) => (
              <div key={alloc.id} className="data-row">
                <span>
                  <strong>
                    {alloc.documentId ? (
                      <Link
                        className="text-link"
                        href={`/b/${businessId}/invoices/${alloc.documentId}`}
                      >
                        Invoice Allocation
                      </Link>
                    ) : alloc.purchaseOrderId ? (
                      <Link
                        className="text-link"
                        href={`/b/${businessId}/purchase-orders/${alloc.purchaseOrderId}`}
                      >
                        Purchase Order Allocation
                      </Link>
                    ) : (
                      "Unassigned Ledger Allocation"
                    )}
                  </strong>
                  <small>ID: {alloc.id}</small>
                </span>
                <strong>
                  {formatMoney(alloc.amountMinor, payment.currencyCode, payment.currencyScale)}
                </strong>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="panel">
          <h2>Allocations</h2>
          <p className="text-muted-foreground">
            This payment is unassigned and not tied to a specific invoice or purchase order.
          </p>
        </section>
      )}

      {hasRefunds && (
        <section className="panel" style={{ marginTop: "1rem" }}>
          <h2>Refunds</h2>
          <p>
            Net of refunds:{" "}
            {formatMoney(payment.netAmountMinor, payment.currencyCode, payment.currencyScale)} (
            {formatMoney(payment.refundedMinor, payment.currencyCode, payment.currencyScale)}{" "}
            returned)
          </p>
          <table className="data-table" style={{ width: "100%", marginTop: "0.5rem" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Date</th>
                <th style={{ textAlign: "left" }}>Reason</th>
                <th style={{ textAlign: "right" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {payment.refunds.map((refund) => (
                <tr key={refund.id}>
                  <td>{refund.createdAt.slice(0, 10)}</td>
                  <td>{refund.reason || "None"}</td>
                  <td style={{ textAlign: "right" }}>
                    {formatMoney(refund.amountMinor, refund.currencyCode, refund.currencyScale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {mayManage && payment.status === "DRAFT" && (
        <section className="panel" style={{ marginTop: "1rem" }}>
          <h2>Void payment</h2>
          <VoidPaymentButton businessId={businessId} paymentId={paymentId} />
        </section>
      )}

      {mayManage && payment.status === "COMPLETED" && (
        <>
          <section className="panel" style={{ marginTop: "1rem" }}>
            <h2>Reverse payment</h2>
            <ReversePaymentButton
              businessId={businessId}
              paymentId={paymentId}
              paymentType={payment.type}
            />
          </section>
          <section className="panel" style={{ marginTop: "1rem" }}>
            <h2>Refund payment</h2>
            <RefundPaymentForm
              businessId={businessId}
              paymentId={paymentId}
              currencyScale={payment.currencyScale}
            />
          </section>
        </>
      )}
    </div>
  );
}
