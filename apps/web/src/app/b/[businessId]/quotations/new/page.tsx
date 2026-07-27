import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { type Customer } from "@bizo/contracts/customers";
import { type BusinessSettings } from "@bizo/contracts/platform";

import { QuotationEditor } from "@/components/quotation-editor";
import { apiJson } from "@/lib/api";

export default async function NewQuotationPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ customer?: string }>;
}) {
  const { businessId } = await params;
  const { customer } = await searchParams;
  const [customers, settings] = await Promise.all([
    apiJson<Customer[]>(`/businesses/${businessId}/customers`),
    apiJson<BusinessSettings>(`/businesses/${businessId}/settings`),
  ]);
  if (!customers.length) redirect(`/b/${businessId}/customers/new`);

  return (
    <div className="page">
      <Link className="back-link" href={`/b/${businessId}`}>
        <ChevronLeft aria-hidden="true" size={18} /> Back
      </Link>
      <header className="page-heading">
        <span className="step-label">Step 4 of 4</span>
        <h1>Create your quotation</h1>
        <p>Add what you’re providing and the price. We’ll handle the layout.</p>
      </header>
      <QuotationEditor
        businessId={businessId}
        currency={settings.baseCurrency}
        locale={settings.locale}
        customers={customers}
        defaultCustomerId={customer}
        defaultTaxRate={settings.taxEnabled ? settings.taxRatePercent : "0"}
      />
    </div>
  );
}
