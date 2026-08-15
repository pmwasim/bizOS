import { redirect } from "next/navigation";

import { type BusinessSettings } from "@bizo/contracts/platform";

import { auth } from "@/auth";
import { apiJson } from "@/lib/api";
import { LeadForm } from "@/components/lead-form";

export default async function NewLeadPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const settings = await apiJson<BusinessSettings>(`/businesses/${businessId}/settings`);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Add lead</h1>
          <p>Capture a new sales prospect.</p>
        </div>
      </header>
      <LeadForm businessId={businessId} currencyScale={settings.currencyScale} />
    </div>
  );
}
