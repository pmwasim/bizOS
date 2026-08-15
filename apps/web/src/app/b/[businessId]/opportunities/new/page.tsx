import { redirect } from "next/navigation";

import { type BusinessSettings } from "@bizo/contracts/platform";

import { auth } from "@/auth";
import { apiJson } from "@/lib/api";
import { OpportunityForm } from "@/components/opportunity-form";

export default async function NewOpportunityPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const settings = await apiJson<BusinessSettings>(`/businesses/${businessId}/settings`);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>New opportunity</h1>
          <p>Track a new deal in your pipeline.</p>
        </div>
      </header>
      <OpportunityForm businessId={businessId} currencyScale={settings.currencyScale} />
    </div>
  );
}
