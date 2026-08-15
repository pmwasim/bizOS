import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { SupplierForm } from "@/components/supplier-form";

export default async function NewSupplierPage({
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
          <h1>Add supplier</h1>
          <p>Record a new vendor or company you purchase from.</p>
        </div>
      </header>
      <SupplierForm businessId={businessId} />
    </div>
  );
}
