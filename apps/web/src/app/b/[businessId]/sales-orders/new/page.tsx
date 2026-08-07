import { redirect } from "next/navigation";

import { type Customer } from "@bizo/contracts/customers";

import { auth } from "@/auth";
import { apiJson } from "@/lib/api";
import { SalesOrderForm } from "@/components/sales-order-form";

export default async function NewSalesOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ customer?: string }>;
}) {
  const { businessId } = await params;
  const { customer: customerId } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const customerList = await apiJson<Customer[]>(`/businesses/${businessId}/customers`);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>New sales order</h1>
          <p>Record a confirmed customer order.</p>
        </div>
      </header>
      <SalesOrderForm
        businessId={businessId}
        customers={customerList}
        defaultCustomerId={customerId}
      />
    </div>
  );
}
