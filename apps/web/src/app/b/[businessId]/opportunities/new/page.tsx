import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { OpportunityForm } from "@/components/opportunity-form";

export default async function NewOpportunityPage({
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
          <h1>New opportunity</h1>
          <p>Track a new deal in your pipeline.</p>
        </div>
      </header>
      <OpportunityForm businessId={businessId} />
    </div>
  );
}
