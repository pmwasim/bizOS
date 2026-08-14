import { Plus, Receipt } from "lucide-react";
import Link from "next/link";

import { type SupplierBill } from "@bizo/contracts/supplier-bills";

import { apiJson } from "@/lib/api";
import { formatMinor } from "@/lib/display";

export default async function SupplierBillsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const bills = await apiJson<SupplierBill[]>(
    `/businesses/${businessId}/procurement/supplier-bills`,
  );
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Supplier Bills</h1>
          <p>Incoming bills from suppliers.</p>
        </div>
        <Link
          className="button button-primary"
          href={`/b/${businessId}/procurement/supplier-bills/new`}
        >
          <Plus aria-hidden="true" size={18} /> New supplier bill
        </Link>
      </header>
      {bills.length ? (
        <div className="data-list">
          {bills.map((bill) => (
            <div className="data-row" key={bill.id}>
              <span className="avatar">{bill.number.slice(0, 1)}</span>
              <span className="grow">
                <strong>{bill.number}</strong>
                <small>
                  {bill.supplier.name} &middot; {bill.status} &middot; {bill.matchStatus} &middot;{" "}
                  {formatMinor(bill.totalMinor, bill.currencyScale, bill.currencyCode)}
                </small>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Receipt aria-hidden="true" size={30} />
          <h2>No supplier bills yet</h2>
          <p>Record bills received from suppliers.</p>
        </div>
      )}
    </div>
  );
}
