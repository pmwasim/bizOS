import { Plus, Target } from "lucide-react";
import Link from "next/link";

import { opportunityStageLabel, type Opportunity } from "@bizo/contracts/crm";
import { type BusinessSettings } from "@bizo/contracts/platform";

import { apiJson } from "@/lib/api";
import { formatMinor } from "@/lib/display";

export default async function OpportunitiesPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const [opportunities, settings] = await Promise.all([
    apiJson<Opportunity[]>(`/businesses/${businessId}/opportunities`),
    apiJson<BusinessSettings>(`/businesses/${businessId}/settings`),
  ]);
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Opportunities</h1>
          <p>Track deals through your sales pipeline.</p>
        </div>
        <Link className="button button-primary" href={`/b/${businessId}/opportunities/new`}>
          <Plus aria-hidden="true" size={18} /> New opportunity
        </Link>
      </header>
      {opportunities.length ? (
        <div className="data-list">
          {opportunities.map((opp) => (
            <div className="data-row" key={opp.id}>
              <span className="avatar">{opp.name.slice(0, 1).toUpperCase()}</span>
              <span className="grow">
                <strong>{opp.name}</strong>
                <small>
                  {opportunityStageLabel(opp.stage)} &middot;{" "}
                  {opp.amountMinor
                    ? formatMinor(
                        opp.amountMinor,
                        settings.currencyScale,
                        opp.currencyCode ?? settings.baseCurrency,
                      )
                    : "No value"}
                </small>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Target aria-hidden="true" size={30} />
          <h2>No opportunities yet</h2>
          <p>Convert leads into opportunities to track deals.</p>
        </div>
      )}
    </div>
  );
}
