import { type Lead, type Opportunity } from "@bizo/contracts/crm";
import { type Customer } from "@bizo/contracts/customers";
import { type BusinessSettings } from "@bizo/contracts/platform";

import { apiJson } from "@/lib/api";
import { CrmClientView } from "@/components/crm-client-view";

export default async function CrmPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;

  const [leads, opportunities, customers, settings] = await Promise.all([
    apiJson<Lead[]>(`/businesses/${businessId}/leads`),
    apiJson<Opportunity[]>(`/businesses/${businessId}/opportunities`),
    apiJson<Customer[]>(`/businesses/${businessId}/customers`),
    apiJson<BusinessSettings>(`/businesses/${businessId}/settings`),
  ]);

  return (
    <div className="page">
      <CrmClientView
        businessId={businessId}
        initialLeads={leads}
        initialOpportunities={opportunities}
        customers={customers}
        currency={settings.baseCurrency}
        currencyScale={settings.currencyScale}
      />
    </div>
  );
}
