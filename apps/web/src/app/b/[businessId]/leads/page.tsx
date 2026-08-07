import { Plus, Users } from "lucide-react";
import Link from "next/link";

import { leadStatusLabel, type Lead } from "@bizo/contracts/crm";

import { apiJson } from "@/lib/api";

export default async function LeadsPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const leads = await apiJson<Lead[]>(`/businesses/${businessId}/leads`);
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Leads</h1>
          <p>Potential customers and sales prospects.</p>
        </div>
        <Link className="button button-primary" href={`/b/${businessId}/leads/new`}>
          <Plus aria-hidden="true" size={18} /> Add lead
        </Link>
      </header>
      {leads.length ? (
        <div className="data-list">
          {leads.map((lead) => (
            <div className="data-row" key={lead.id}>
              <span className="avatar">{lead.name.slice(0, 1).toUpperCase()}</span>
              <span className="grow">
                <strong>{lead.name}</strong>
                <small>
                  {lead.company ?? "No company"} &middot; {leadStatusLabel(lead.status)}
                </small>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Users aria-hidden="true" size={30} />
          <h2>No leads yet</h2>
          <p>Capture prospects to build your sales pipeline.</p>
        </div>
      )}
    </div>
  );
}
