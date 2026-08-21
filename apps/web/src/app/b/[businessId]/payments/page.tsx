import { ArrowDownLeft, ArrowUpRight, Plus, Wallet } from "lucide-react";
import Link from "next/link";

import { type Payment, paymentStatusLabel } from "@bizo/contracts/payments";

import { apiJson } from "@/lib/api";
import { formatMoney } from "@/lib/display";

function money(payment: Payment) {
  return formatMoney(payment.amountMinor, payment.currencyCode, payment.currencyScale);
}

export default async function PaymentsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const payments = await apiJson<Payment[]>(`/businesses/${businessId}/payments`).catch(
    () => [] as Payment[],
  );

  const inboundTotalMinor = payments
    .filter((p) => p.type === "INBOUND" && p.status === "COMPLETED")
    .reduce((acc, p) => acc + BigInt(p.amountMinor), 0n);

  const currencyCode = payments[0]?.currencyCode ?? "USD";
  const currencyScale = payments[0]?.currencyScale ?? 2;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Financial Ledger</span>
          <h1>Payments</h1>
          <p>Record of inbound customer receipts and outbound supplier payments.</p>
        </div>
        <Link className="button button-primary" href={`/b/${businessId}/payments/new`}>
          <Plus aria-hidden="true" size={18} /> Record payment
        </Link>
      </header>

      {payments.length > 0 ? (
        <>
          <section className="stats" aria-label="Payments summary">
            <div>
              <span className="stats-label">Total Inbound Collected</span>
              <strong className="text-success">
                {formatMoney(inboundTotalMinor.toString(), currencyCode, currencyScale)}
              </strong>
            </div>
            <div>
              <span className="stats-label">Total Transactions</span>
              <strong>{payments.length}</strong>
            </div>
          </section>

          <div className="data-list">
            {payments.map((payment) => (
              <Link
                key={payment.id}
                href={`/b/${businessId}/payments/${payment.id}`}
                className="data-row quotation-row"
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div
                    style={{
                      background: payment.type === "INBOUND" ? "var(--success-bg)" : "var(--muted)",
                      color: payment.type === "INBOUND" ? "var(--success)" : "var(--foreground)",
                      borderRadius: "50%",
                      width: "36px",
                      height: "36px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {payment.type === "INBOUND" ? (
                      <ArrowDownLeft size={18} />
                    ) : (
                      <ArrowUpRight size={18} />
                    )}
                  </div>
                  <span>
                    <strong>
                      {payment.type === "INBOUND" ? "Received Payment" : "Sent Payment"}
                    </strong>
                    <small>
                      {payment.reference ? `Ref: ${payment.reference}` : "No reference"}
                      {payment.allocations.length > 0
                        ? ` · ${payment.allocations.length} allocation${payment.allocations.length > 1 ? "s" : ""}`
                        : ""}
                    </small>
                  </span>
                </div>
                <span className="row-date">{payment.paymentDate}</span>
                <strong>{money(payment)}</strong>
                <span className={`status status-${payment.status.toLowerCase()}`}>
                  {paymentStatusLabel(payment.status)}
                </span>
              </Link>
            ))}
          </div>
        </>
      ) : (
        <div className="empty-state">
          <Wallet aria-hidden="true" size={32} />
          <h2>No payments recorded yet</h2>
          <p>Log your customer payments and allocations as funds arrive.</p>
          <div style={{ marginTop: "1rem" }}>
            <Link className="button button-primary" href={`/b/${businessId}/payments/new`}>
              <Plus aria-hidden="true" size={16} /> Record first payment
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
