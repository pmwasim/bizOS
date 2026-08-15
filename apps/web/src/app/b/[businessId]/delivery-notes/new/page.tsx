import { redirect } from "next/navigation";

import { type Customer } from "@bizo/contracts/customers";

import { auth } from "@/auth";
import { apiJson } from "@/lib/api";
import { DeliveryNoteForm } from "@/components/delivery-note-form";

export default async function NewDeliveryNotePage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ customer?: string; salesOrderId?: string; order?: string }>;
}) {
  const { businessId } = await params;
  const { customer: customerId, salesOrderId, order } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const customerList = await apiJson<Customer[]>(`/businesses/${businessId}/customers`);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>New delivery note</h1>
          <p>Record goods delivered or services completed.</p>
        </div>
      </header>
      <DeliveryNoteForm
        businessId={businessId}
        customers={customerList}
        defaultCustomerId={customerId}
        defaultSalesOrderId={salesOrderId ?? order}
      />
    </div>
  );
}
