import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { InventoryItemForm } from "@/components/inventory-item-form";

export default async function NewInventoryItemPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Add inventory item</h1>
          <p>Add a product or service to your catalogue.</p>
        </div>
      </header>
      <InventoryItemForm businessId={businessId} />
    </div>
  );
}
