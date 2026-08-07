import { Plus, Package } from "lucide-react";
import Link from "next/link";

import { type InventoryItem } from "@bizo/contracts/inventory";

import { apiJson } from "@/lib/api";
import { formatMinor } from "@/lib/display";

export default async function InventoryPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const items = await apiJson<InventoryItem[]>(`/businesses/${businessId}/inventory`);
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Inventory</h1>
          <p>Products, services, and stock items.</p>
        </div>
        <Link className="button button-primary" href={`/b/${businessId}/inventory/new`}>
          <Plus aria-hidden="true" size={18} /> Add item
        </Link>
      </header>
      {items.length ? (
        <div className="data-list">
          {items.map((item) => (
            <div className="data-row" key={item.id}>
              <span className="avatar">{item.sku.slice(0, 1).toUpperCase()}</span>
              <span className="grow">
                <strong>{item.name}</strong>
                <small>
                  {item.sku} &middot;{" "}
                  {item.sellingPriceMinor
                    ? formatMinor(item.sellingPriceMinor, 2, "USD")
                    : "No price"}
                </small>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Package aria-hidden="true" size={30} />
          <h2>No inventory items yet</h2>
          <p>Add products or services to track and sell.</p>
        </div>
      )}
    </div>
  );
}
