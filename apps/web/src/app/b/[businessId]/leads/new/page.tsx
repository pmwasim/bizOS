import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { LeadForm } from "@/components/lead-form";

export default async function NewLeadPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Add lead</h1>
          <p>Capture a new sales prospect.</p>
        </div>
      </header>
      <LeadForm businessId={businessId} />
    </div>
  );
}
