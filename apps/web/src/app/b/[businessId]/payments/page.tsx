import { Wallet } from "lucide-react";
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
  const payments = await apiJson<Payment[]>(`/businesses/${businessId}/payments`);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Payments</h1>
          <p>Record of inbound and outbound payments and their allocations.</p>
        </div>
      </header>
      {payments.length ? (
        <div className="data-list">
          {payments.map((payment) => (
            <Link
              key={payment.id}
              href={`/b/${businessId}/payments/${payment.id}`}
              className="data-row"
            >
              <span>
                <strong>{payment.type === "INBOUND" ? "Received" : "Sent"}</strong>
                <small>
                  {payment.reference ? `Ref: ${payment.reference}` : "No reference"}
                  {payment.allocations.length > 0
                    ? ` · Allocations: ${payment.allocations.length}`
                    : ""}
                </small>
              </span>
              <span className="row-date">{payment.paymentDate}</span>
              <strong>{money(payment)}</strong>
              <span className={`status status-${payment.status.toLowerCase()}`}>
                {paymentStatusLabel(payment.status)}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Wallet aria-hidden="true" size={30} />
          <h2>No payments yet</h2>
          <p>You haven't recorded any inbound or outbound payments.</p>
        </div>
      )}
    </div>
  );
}
