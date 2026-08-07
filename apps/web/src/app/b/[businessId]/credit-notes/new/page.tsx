import { redirect } from "next/navigation";

import { type Customer } from "@bizo/contracts/customers";
import { type Invoice } from "@bizo/contracts/invoices";

import { auth } from "@/auth";
import { apiJson } from "@/lib/api";
import { CreditNoteForm } from "@/components/credit-note-form";

export default async function NewCreditNotePage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ invoice?: string }>;
}) {
  const { businessId } = await params;
  const { invoice: invoiceId } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const [customerList, invoiceList] = await Promise.all([
    apiJson<Customer[]>(`/businesses/${businessId}/customers`),
    apiJson<Invoice[]>(`/businesses/${businessId}/invoices`),
  ]);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>New credit note</h1>
          <p>Correct or adjust an issued invoice.</p>
        </div>
      </header>
      <CreditNoteForm
        businessId={businessId}
        customers={customerList}
        invoices={invoiceList}
        defaultInvoiceId={invoiceId}
      />
    </div>
  );
}
