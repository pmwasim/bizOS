import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import { paymentMethodLabel, type CustomerPayment } from "@bizo/contracts/payments";

import { VoidPaymentButton } from "@/components/payment-actions";
import { apiJson } from "@/lib/api";
import { formatMoney } from "@/lib/display";

export default async function PaymentDetailPage({
  params,
}: {
  params: Promise<{ businessId: string; paymentId: string }>;
}) {
  const { businessId, paymentId } = await params;
  const payment = await apiJson<CustomerPayment>(`/businesses/${businessId}/payments/${paymentId}`);

  return (
    <div className="page">
      <div className="preview-toolbar">
        <Link className="back-link" href={`/b/${businessId}/payments`}>
          <ChevronLeft aria-hidden="true" size={18} /> Payments
        </Link>
      </div>
      <header className="preview-title">
        <div>
          <span className={`status status-${payment.status.toLowerCase()}`}>
            {payment.status === "VOIDED" ? "Voided" : "Recorded"}
          </span>
          <h1>{payment.number}</h1>
          <p>From {payment.customer.name}</p>
        </div>
      </header>

      <section className="panel">
        <h2>Payment details</h2>
        <p>
          <strong>
            {formatMoney(payment.amountMinor, payment.currencyCode, payment.currencyScale)}
          </strong>{" "}
          via {paymentMethodLabel(payment.method)} on {payment.receivedOn}
        </p>
        {payment.reference ? <p>Reference: {payment.reference}</p> : null}
        {payment.notes ? <p>{payment.notes}</p> : null}
        {payment.voidReason ? <p>Void reason: {payment.voidReason}</p> : null}
      </section>

      <section className="panel">
        <h2>Allocated to</h2>
        <div className="data-list">
          {payment.allocations.map((allocation) => (
            <Link
              key={allocation.id}
              className="data-row"
              href={`/b/${businessId}/invoices/${allocation.invoice.id}`}
            >
              <span className="grow">
                <strong>{allocation.invoice.number}</strong>
                <small>
                  {formatMoney(allocation.amountMinor, payment.currencyCode, payment.currencyScale)}
                </small>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {payment.status === "RECORDED" ? (
        <section className="panel danger-panel">
          <h2>Void</h2>
          <p>Voiding removes this payment from invoice balances. The record stays for audit.</p>
          <VoidPaymentButton businessId={businessId} paymentId={payment.id} />
        </section>
      ) : null}
    </div>
  );
}
