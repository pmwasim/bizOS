import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { type Invoice } from "@bizo/contracts/invoices";
import { settlementStatusLabel, type InvoicePaymentSummary } from "@bizo/contracts/payments";
import { formatScaledInteger } from "@bizo/contracts/money";

import { RecordPaymentForm } from "@/components/record-payment-form";
import { apiJson } from "@/lib/api";
import { formatMoney } from "@/lib/display";

export default async function NewPaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ invoiceId?: string }>;
}) {
  const { businessId } = await params;
  const query = await searchParams;
  if (!query.invoiceId) {
    notFound();
  }

  const [invoice, summary] = await Promise.all([
    apiJson<Invoice>(`/businesses/${businessId}/invoices/${query.invoiceId}`),
    apiJson<InvoicePaymentSummary>(
      `/businesses/${businessId}/invoices/${query.invoiceId}/payments`,
    ),
  ]);

  if (invoice.status !== "SENT") {
    notFound();
  }

  const defaultAmount = formatScaledInteger(
    BigInt(summary.outstandingMinor),
    invoice.currencyScale,
  );

  return (
    <div className="page">
      <Link className="back-link" href={`/b/${businessId}/invoices/${invoice.id}`}>
        <ChevronLeft aria-hidden="true" size={18} /> {invoice.number}
      </Link>
      <header className="page-header">
        <div>
          <h1>Record payment</h1>
          <p>
            <span className={`status status-${summary.settlementStatus.toLowerCase()}`}>
              {settlementStatusLabel(summary.settlementStatus)}
            </span>{" "}
            &middot; Outstanding{" "}
            {formatMoney(summary.outstandingMinor, invoice.currencyCode, invoice.currencyScale)} of{" "}
            {formatMoney(summary.totalMinor, invoice.currencyCode, invoice.currencyScale)} for{" "}
            {invoice.customer.name}.
          </p>
        </div>
      </header>
      <RecordPaymentForm
        businessId={businessId}
        invoiceId={invoice.id}
        defaultAmount={defaultAmount}
        currencyCode={invoice.currencyCode}
        currencyScale={invoice.currencyScale}
      />
    </div>
  );
}
