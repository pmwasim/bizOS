import { ArrowLeft, CheckCircle2 } from "lucide-react";
import Link from "next/link";

import { CustomizationRequestForm } from "@/components/customization-request-form";

export default async function SettingsCustomizationPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ submitted?: string }>;
}) {
  const { businessId } = await params;
  const query = await searchParams;

  return (
    <div className="page">
      <header className="page-heading">
        <Link className="text-link" href={`/b/${businessId}/settings`}>
          <ArrowLeft aria-hidden="true" size={16} />
          Back to settings
        </Link>
        <h1>Request customization</h1>
        <p>
          Tell us how your business works and what you need changed. This does not block your
          workspace — you can keep using bizOS while we review your request.
        </p>
      </header>
      {query.submitted === "1" ? (
        <div className="success-banner" role="status">
          <CheckCircle2 aria-hidden="true" />
          <span>
            <strong>Request submitted</strong>
            We saved your customization request. Our team will review it and may follow up.
          </span>
        </div>
      ) : null}
      <CustomizationRequestForm businessId={businessId} />
    </div>
  );
}
