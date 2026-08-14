import { type CreditNote } from "@bizo/contracts/credit-notes";
import { type Customer } from "@bizo/contracts/customers";
import { type Invoice } from "@bizo/contracts/invoices";

import { apiJson } from "@/lib/api";
import { CreditNotesClientView } from "@/components/credit-notes-client-view";

export default async function CreditNotesPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  let creditNotes: CreditNote[];
  let customers: Customer[];
  let invoices: Invoice[];

  try {
    creditNotes = await apiJson<CreditNote[]>(`/businesses/${businessId}/credit-notes`);
  } catch {
    creditNotes = [];
  }

  try {
    customers = await apiJson<Customer[]>(`/businesses/${businessId}/customers`);
  } catch {
    customers = [];
  }

  try {
    invoices = await apiJson<Invoice[]>(`/businesses/${businessId}/invoices`);
  } catch {
    invoices = [];
  }

  return (
    <div className="page">
      <CreditNotesClientView
        businessId={businessId}
        initialCreditNotes={creditNotes}
        customers={customers}
        invoices={invoices}
      />
    </div>
  );
}
