import { ChevronLeft, Download } from "lucide-react";
import Link from "next/link";

import { type Payment, paymentStatusLabel } from "@bizo/contracts/payments";

import {
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
 *
 * Mirrored here so the page does not offer an action the API will refuse. `payments:read` is much
 * broader — MEMBER, STAFF, ACCOUNTANT and EXTERNAL_AUDITOR can all open this page — and a refused
 * mutation comes back as a deliberately opaque "not found", which reads as a bug rather than a
 * permission boundary.
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

  return (
    <div className="page preview-page">
      <div className="preview-toolbar">
        <Link className="back-link" href={`/b/${businessId}/payments`}>
          <ChevronLeft aria-hidden="true" size={18} /> Payments
        </Link>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <a className="button button-secondary" href={`${pdfPath}?download=1`}>
            <Download aria-hidden="true" size={17} /> Download receipt
          </a>
        </div>
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

      {/*
        The payment state machine gates each action: a DRAFT can be voided (it never settled
        anything), and a COMPLETED payment can be reversed (its allocations stop counting toward
        settlement) or refunded (money returned, tracked as a distinct record). REVERSED and VOIDED
        are terminal. Only OWNER/ADMIN see these — the API refuses everyone else.
      */}
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
