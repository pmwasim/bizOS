import { CheckCircle2 } from "lucide-react";

import { type BusinessSettings } from "@bizo/contracts/platform";

import { SettingsForm } from "@/components/settings-form";
import { apiJson } from "@/lib/api";

export default async function SettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { businessId } = await params;
  const query = await searchParams;
  const settings = await apiJson<BusinessSettings>(`/businesses/${businessId}/settings`);
  return (
    <div className="page">
      <header className="page-heading">
        <h1>Settings</h1>
        <p>Business details and the defaults that save you time.</p>
      </header>
      {query.saved === "1" ? (
        <div className="success-banner" role="status">
          <CheckCircle2 aria-hidden="true" />
          <span>
            <strong>Changes saved</strong>
            New quotations will use these details.
          </span>
        </div>
      ) : null}
      <SettingsForm businessId={businessId} settings={settings} />
    </div>
  );
}
