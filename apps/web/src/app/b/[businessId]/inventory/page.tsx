import { type InventoryItem } from "@bizo/contracts/inventory";

import { apiJson } from "@/lib/api";
import { InventoryClientView } from "@/components/inventory-client-view";

export default async function InventoryPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  let items: InventoryItem[];

  try {
    items = await apiJson<InventoryItem[]>(`/businesses/${businessId}/inventory`);
  } catch {
    items = [];
  }

  return (
    <div className="page">
      <InventoryClientView businessId={businessId} initialItems={items} />
    </div>
  );
}
