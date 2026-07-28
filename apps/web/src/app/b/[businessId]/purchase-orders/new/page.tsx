import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import { type Customer } from "@bizo/contracts/customers";
import { type Quotation } from "@bizo/contracts/quotations";

import { PurchaseOrderForm } from "@/components/purchase-order-form";
import { apiJson } from "@/lib/api";

export default async function NewPurchaseOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ customer?: string; quotation?: string }>;
}) {
  const { businessId } = await params;
  const query = await searchParams;
  const [customers, quotations] = await Promise.all([
    apiJson<Customer[]>(`/businesses/${businessId}/customers`),
    apiJson<Quotation[]>(`/businesses/${businessId}/quotations`),
  ]);

  return (
    <div className="page narrow-page">
      <Link className="back-link" href={`/b/${businessId}/purchase-orders`}>
        <ChevronLeft aria-hidden="true" size={18} /> Purchase orders
      </Link>
      <header className="page-heading">
        <h1>Add a purchase order</h1>
        <p>Record the customer PO number and link it to a quotation when you have one.</p>
      </header>
      <PurchaseOrderForm
        businessId={businessId}
        customers={customers.map((customer) => ({ id: customer.id, name: customer.name }))}
        quotations={quotations.map((quotation) => ({
          id: quotation.id,
          number: quotation.number,
          customerId: quotation.customer.id,
        }))}
        {...(query.customer ? { defaultCustomerId: query.customer } : {})}
        {...(query.quotation ? { defaultQuotationId: query.quotation } : {})}
      />
    </div>
  );
}
