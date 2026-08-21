import { ArrowRight, CheckCircle2, MessageSquarePlus, Sparkles } from "lucide-react";
import Link from "next/link";

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
      <Link className="guided-setup-card" href={`/b/${businessId}/settings/setup`}>
        <Sparkles aria-hidden="true" size={20} />
        <div>
          <strong>Guided setup</strong>
          <small>Answer a few questions and we&apos;ll reconfigure your workspace.</small>
        </div>
        <ArrowRight aria-hidden="true" size={18} />
      </Link>
      <Link className="guided-setup-card" href={`/b/${businessId}/settings/customization`}>
        <MessageSquarePlus aria-hidden="true" size={20} />
        <div>
          <strong>Request customization</strong>
          <small>Describe process changes for our team to review.</small>
        </div>
        <ArrowRight aria-hidden="true" size={18} />
      </Link>
      <Link className="guided-setup-card" href="/subscribe">
        <Sparkles aria-hidden="true" size={20} />
        <div>
          <strong>Qloudi Pro subscription</strong>
          <small>Upgrade, check entitlement status, or open the billing portal.</small>
        </div>
        <ArrowRight aria-hidden="true" size={18} />
      </Link>
      <SettingsForm businessId={businessId} settings={settings} />
    </div>
  );
}
