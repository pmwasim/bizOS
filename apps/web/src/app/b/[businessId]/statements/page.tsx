import { type Customer } from "@bizo/contracts/customers";
import { type Supplier } from "@bizo/contracts/suppliers";

import { apiJson } from "@/lib/api";
import { StatementsClientView } from "@/components/statements-client-view";

export default async function StatementsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  let customers: Customer[];
  let suppliers: Supplier[];

  try {
    customers = await apiJson<Customer[]>(`/businesses/${businessId}/customers`);
  } catch {
    customers = [];
  }

  try {
    suppliers = await apiJson<Supplier[]>(`/businesses/${businessId}/suppliers`);
  } catch {
    suppliers = [];
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Statements & 5-Tier Aging Reports</h1>
          <p>
            Generate customer and supplier ledger statements with 5-tier overdue aging breakdown.
          </p>
        </div>
      </header>

      <StatementsClientView businessId={businessId} customers={customers} suppliers={suppliers} />
    </div>
  );
}
