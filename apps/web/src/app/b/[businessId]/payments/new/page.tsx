import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import { type Invoice } from "@bizo/contracts/invoices";
import { type BusinessSettings } from "@bizo/contracts/platform";

import { PaymentForm } from "@/components/payment-form";
import { apiJson } from "@/lib/api";
import { formatMoney } from "@/lib/display";

export default async function NewPaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ invoiceId?: string; amount?: string }>;
}) {
  const { businessId } = await params;
  const { invoiceId, amount } = await searchParams;

  const [settings, invoices] = await Promise.all([
    apiJson<BusinessSettings>(`/businesses/${businessId}/settings`),
    apiJson<Invoice[]>(`/businesses/${businessId}/invoices`).catch(() => [] as Invoice[]),
  ]);

  const invoiceOptions = invoices.map((inv) => ({
    id: inv.id,
    number: inv.number,
    customerName: inv.customer.name,
    totalFormatted: formatMoney(inv.totalMinor, inv.currencyCode, inv.currencyScale),
  }));

  return (
    <div className="page">
      <Link className="back-link" href={`/b/${businessId}/payments`}>
        <ChevronLeft aria-hidden="true" size={18} /> Payments
      </Link>
      <header className="page-heading">
        <span className="eyebrow">Financial Ledger</span>
        <h1>Record a payment</h1>
        <p>Log customer receipts or supplier disbursements with optional invoice allocations.</p>
      </header>
      <PaymentForm
        businessId={businessId}
        currency={settings.baseCurrency}
        defaultInvoiceId={invoiceId}
        defaultAmount={amount}
        invoices={invoiceOptions}
      />
    </div>
  );
}
