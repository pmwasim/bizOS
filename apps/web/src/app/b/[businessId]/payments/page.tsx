import { Banknote, Plus } from "lucide-react";
import Link from "next/link";

import { paymentMethodLabel, type CustomerPayment } from "@bizo/contracts/payments";

import { apiJson } from "@/lib/api";
import { formatMoney } from "@/lib/display";

export default async function PaymentsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const payments = await apiJson<CustomerPayment[]>(`/businesses/${businessId}/payments`);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Payments</h1>
          <p>Record money received against sent invoices.</p>
        </div>
      </header>
      {payments.length ? (
        <div className="data-list">
          {payments.map((payment) => (
            <Link
              key={payment.id}
              href={`/b/${businessId}/payments/${payment.id}`}
              className="data-row quotation-row"
            >
              <span>
                <strong>{payment.number}</strong>
                <small>
                  {payment.customer.name} · {paymentMethodLabel(payment.method)}
                </small>
              </span>
              <span className="row-date">{payment.receivedOn}</span>
              <strong>
                {formatMoney(payment.amountMinor, payment.currencyCode, payment.currencyScale)}
              </strong>
              <span className={`status status-${payment.status.toLowerCase()}`}>
                {payment.status === "VOIDED" ? "Voided" : "Recorded"}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Banknote aria-hidden="true" size={30} />
          <h2>No payments yet</h2>
          <p>Open a sent invoice and record a payment against it.</p>
          <Link className="button button-secondary" href={`/b/${businessId}/invoices`}>
            <Plus aria-hidden="true" size={16} /> Go to invoices
          </Link>
        </div>
      )}
    </div>
  );
}
