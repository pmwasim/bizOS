import { type CreditNote } from "@bizo/contracts/credit-notes";
import { type Customer } from "@bizo/contracts/customers";
import { type Invoice } from "@bizo/contracts/invoices";
import { type BusinessSettings } from "@bizo/contracts/platform";

import { apiJson } from "@/lib/api";
import { CreditNotesClientView } from "@/components/credit-notes-client-view";

export default async function CreditNotesPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  const [creditNotes, customers, invoices, settings] = await Promise.all([
    apiJson<CreditNote[]>(`/businesses/${businessId}/credit-notes`),
    apiJson<Customer[]>(`/businesses/${businessId}/customers`),
    apiJson<Invoice[]>(`/businesses/${businessId}/invoices`),
    apiJson<BusinessSettings>(`/businesses/${businessId}/settings`),
  ]);

  return (
    <div className="page">
      <CreditNotesClientView
        businessId={businessId}
        initialCreditNotes={creditNotes}
        customers={customers}
        invoices={invoices}
        currency={settings.baseCurrency}
        currencyScale={settings.currencyScale}
      />
    </div>
  );
}
