import { type InventoryItem } from "@bizo/contracts/inventory";
import { type BusinessSettings } from "@bizo/contracts/platform";

import { apiJson } from "@/lib/api";
import { InventoryClientView } from "@/components/inventory-client-view";

export default async function InventoryPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  const [items, settings] = await Promise.all([
    apiJson<InventoryItem[]>(`/businesses/${businessId}/inventory`),
    apiJson<BusinessSettings>(`/businesses/${businessId}/settings`),
  ]);

  return (
    <div className="page">
      <InventoryClientView
        businessId={businessId}
        initialItems={items}
        currency={settings.baseCurrency}
        currencyScale={settings.currencyScale}
      />
    </div>
  );
}
