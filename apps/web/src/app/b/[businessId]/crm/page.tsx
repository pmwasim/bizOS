import { type Lead, type Opportunity } from "@bizo/contracts/crm";
import { type Customer } from "@bizo/contracts/customers";

import { apiJson } from "@/lib/api";
import { CrmClientView } from "@/components/crm-client-view";

export default async function CrmPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;

  let leads: Lead[];
  let opportunities: Opportunity[];
  let customers: Customer[];

  try {
    leads = await apiJson<Lead[]>(`/businesses/${businessId}/leads`);
  } catch {
    leads = [];
  }

  try {
    opportunities = await apiJson<Opportunity[]>(`/businesses/${businessId}/opportunities`);
  } catch {
    opportunities = [];
  }

  try {
    customers = await apiJson<Customer[]>(`/businesses/${businessId}/customers`);
  } catch {
    customers = [];
  }

  return (
    <div className="page">
      <CrmClientView
        businessId={businessId}
        initialLeads={leads}
        initialOpportunities={opportunities}
        customers={customers}
      />
    </div>
  );
}
