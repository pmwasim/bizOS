"use client";

import { useState } from "react";
import { Users, Target, Plus, X, ArrowRight, MessageSquare, Sparkles } from "lucide-react";

import {
  type CrmActivity,
  type Lead,
  type Opportunity,
  type OpportunityStage,
  crmActivityTypeLabel,
  opportunityStageLabel,
  leadStatusLabel,
} from "@bizo/contracts/crm";
import { type Customer } from "@bizo/contracts/customers";
import { formatMoney } from "@/lib/display";
import { convertLeadAction, updateOpportunityStageAction } from "@/app/actions";
import { ActionMessage } from "@/components/action-message";

function formatOpportunityTotals(
  opportunities: Opportunity[],
  fallbackCurrency: string,
  currencyScale: number,
): string {
  const totalsByCurrency = new Map<string, number>();
  for (const opportunity of opportunities) {
    if (!opportunity.amountMinor) continue;
    const currency = opportunity.currencyCode ?? fallbackCurrency;
    totalsByCurrency.set(
      currency,
      (totalsByCurrency.get(currency) ?? 0) + Number(opportunity.amountMinor),
    );
  }

  if (totalsByCurrency.size === 0) {
    return formatMoney("0", fallbackCurrency, currencyScale);
  }

  return Array.from(totalsByCurrency, ([currency, totalMinor]) =>
    formatMoney(String(totalMinor), currency, currencyScale),
  ).join(" · ");
}

export function CrmClientView({
  businessId,
  initialLeads,
  initialOpportunities,
  initialActivities,
  customers: _customers,
  currency,
  currencyScale,
}: {
  businessId: string;
  initialLeads: Lead[];
  initialOpportunities: Opportunity[];
  initialActivities: CrmActivity[];
  customers: Customer[];
  currency: string;
  currencyScale: number;
}) {
  const [activeTab, setActiveTab] = useState<"kanban" | "leads" | "feed">("kanban");
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [opportunities, setOpportunities] = useState<Opportunity[]>(initialOpportunities);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [isOppModalOpen, setIsOppModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  async function handleConvertLead(leadId: string) {
    setLoading(true);
    setError(undefined);

    // Previously this marked the lead CONVERTED on success, on failure, and on exception
    // alike, so a rejected conversion still showed the business a customer it did not have.
    const lead = leads.find((candidate) => candidate.id === leadId);
    const result = await convertLeadAction(businessId, leadId);
    if (result.error) {
      setError(result.error);
    } else {
      setLeads((prev) =>
        prev.map((candidate) =>
          candidate.id === leadId
            ? { ...candidate, status: "CONVERTED" as const, convertedAt: new Date().toISOString() }
            : candidate,
        ),
      );
      // Surface the newly created opportunity on the Kanban immediately instead
      // of waiting for a full reload.
      if (lead && result.opportunityId) {
        const opportunityId = result.opportunityId;
        const now = new Date().toISOString();
        const opportunityName =
          lead.company && lead.company.trim().length > 0 ? lead.company : lead.name;
        setOpportunities((prev) =>
          prev.some((opportunity) => opportunity.id === opportunityId)
            ? prev
            : [
                ...prev,
                {
                  id: opportunityId,
                  name: opportunityName,
                  stage: "PROSPECTING" as const,
                  probability: null,
                  amountMinor: lead.estimatedValue,
                  currencyCode: lead.currencyCode,
                  expectedCloseDate: null,
                  actualCloseDate: null,
                  notes: null,
                  lead: { id: lead.id, name: lead.name },
                  quotation: null,
                  createdAt: now,
                  updatedAt: now,
                },
              ],
        );
      }
    }
    setLoading(false);
  }

  // Moving a card previously changed local state only, so the board looked saved and was not.
  async function updateOppStage(oppId: string, newStage: OpportunityStage) {
    const previous = opportunities;
    setError(undefined);
    setOpportunities((prev) => prev.map((o) => (o.id === oppId ? { ...o, stage: newStage } : o)));

    const result = await updateOpportunityStageAction(businessId, oppId, newStage);
    if (result.error) {
      setOpportunities(previous);
      setError(result.error);
    }
  }

  const kanbanStages: OpportunityStage[] = [
    "PROSPECTING",
    "QUALIFICATION",
    "PROPOSAL",
    "NEGOTIATION",
    "CLOSED_WON",
    "CLOSED_LOST",
  ];

  return (
    <>
      <header className="page-header">
        <div>
          <h1>CRM & Deal Pipeline</h1>
          <p>
            Manage leads, Kanban deal pipeline, customer activity feeds, and 1-click deal
            conversions.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            className="button button-secondary"
            type="button"
            onClick={() => setIsLeadModalOpen(true)}
          >
            <Plus aria-hidden="true" size={18} /> New Lead
          </button>
          <button
            className="button button-primary"
            type="button"
            onClick={() => setIsOppModalOpen(true)}
          >
            <Target aria-hidden="true" size={18} /> New Opportunity
          </button>
        </div>
      </header>

      <ActionMessage error={error} />

      {/* Tabs */}
      <div className="check-field" style={{ display: "flex", gap: "1rem", marginBottom: "2rem" }}>
        <button
          type="button"
          className={`button ${activeTab === "kanban" ? "button-primary" : "button-secondary"}`}
          onClick={() => setActiveTab("kanban")}
        >
          <Target size={18} /> Kanban Pipeline (FEAT-26)
        </button>
        <button
          type="button"
          className={`button ${activeTab === "leads" ? "button-primary" : "button-secondary"}`}
          onClick={() => setActiveTab("leads")}
        >
          <Users size={18} /> Lead Directory & 1-Click Convert (FEAT-28)
        </button>
        <button
          type="button"
          className={`button ${activeTab === "feed" ? "button-primary" : "button-secondary"}`}
          onClick={() => setActiveTab("feed")}
        >
          <MessageSquare size={18} /> Customer Activity Feed (FEAT-27)
        </button>
      </div>

      {/* TAB 1: KANBAN DEAL PIPELINE */}
      {activeTab === "kanban" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(6, 1fr)",
            gap: "1rem",
            overflowX: "auto",
          }}
        >
          {kanbanStages.map((stage) => {
            const stageOpps = opportunities.filter((o) => o.stage === stage);
            return (
              <div
                key={stage}
                style={{
                  background: "var(--surface-subtle)",
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--border)",
                  padding: "0.75rem",
                  minHeight: "450px",
                }}
              >
                <div
                  style={{
                    borderBottom: "1px solid var(--border)",
                    paddingBottom: "0.5rem",
                    marginBottom: "0.75rem",
                  }}
                >
                  <strong style={{ fontSize: "0.85rem", display: "block" }}>
                    {opportunityStageLabel(stage)}
                  </strong>
                  <small style={{ color: "var(--muted-foreground)" }}>
                    {stageOpps.length} deals ·{" "}
                    {formatOpportunityTotals(stageOpps, currency, currencyScale)}
                  </small>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {stageOpps.map((opp) => (
                    <div
                      key={opp.id}
                      style={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: "0.5rem",
                        padding: "0.75rem",
                        boxShadow: "0 2px 5px rgba(0,0,0,0.03)",
                      }}
                    >
                      <strong
                        style={{ fontSize: "0.9rem", display: "block", marginBottom: "0.25rem" }}
                      >
                        {opp.name}
                      </strong>
                      <small style={{ color: "var(--muted-foreground)", display: "block" }}>
                        {opp.lead?.name || "Customer Deal"}
                      </small>
                      <div
                        style={{
                          marginTop: "0.5rem",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <strong style={{ color: "var(--primary)", fontSize: "0.95rem" }}>
                          {opp.amountMinor
                            ? formatMoney(
                                opp.amountMinor,
                                opp.currencyCode ?? currency,
                                currencyScale,
                              )
                            : "N/A"}
                        </strong>
                        <span className="status status-ready_to_send">{opp.probability}% win</span>
                      </div>

                      {/* Quick stage transition button */}
                      {stage !== "CLOSED_WON" && (
                        <button
                          type="button"
                          className="button button-quiet"
                          onClick={() => {
                            const nextStageIndex = kanbanStages.indexOf(stage) + 1;
                            if (nextStageIndex < kanbanStages.length) {
                              updateOppStage(opp.id, kanbanStages[nextStageIndex]!);
                            }
                          }}
                          style={{
                            marginTop: "0.5rem",
                            width: "100%",
                            fontSize: "0.75rem",
                            minHeight: "28px",
                            padding: "0.2rem",
                          }}
                        >
                          Move Next <ArrowRight size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                  {stageOpps.length === 0 && (
                    <small
                      style={{
                        color: "var(--muted-foreground)",
                        textAlign: "center",
                        display: "block",
                        marginTop: "2rem",
                      }}
                    >
                      No deals
                    </small>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: LEADS DIRECTORY & 1-CLICK CONVERT */}
      {activeTab === "leads" && (
        <div className="recent-section">
          <div className="section-heading">
            <h2>Lead Directory & Instant Conversion</h2>
            <small>{leads.length} leads listed</small>
          </div>

          <div className="data-list">
            <div
              className="data-row"
              style={{
                fontWeight: 800,
                background: "var(--surface-subtle)",
                borderBottom: "2px solid var(--border)",
              }}
            >
              <span className="grow">Lead / Company Name</span>
              <span style={{ width: "150px" }}>Contact Info</span>
              <span style={{ width: "110px" }}>Source</span>
              <span style={{ width: "110px" }}>Est. Value</span>
              <span style={{ width: "100px" }}>Status</span>
              <span style={{ width: "160px", textAlign: "right" }}>Action</span>
            </div>

            {leads.map((lead) => (
              <div className="data-row" key={lead.id}>
                <span className="grow">
                  <strong>{lead.name}</strong>
                  <small>{lead.company || "Individual Lead"}</small>
                </span>
                <span style={{ width: "150px" }}>
                  <small>{lead.email || "No email"}</small>
                  <small>{lead.phone || ""}</small>
                </span>
                <span style={{ width: "110px" }}>{lead.source || "Direct"}</span>
                <strong style={{ width: "110px" }}>
                  {lead.estimatedValue
                    ? formatMoney(lead.estimatedValue, lead.currencyCode ?? currency, currencyScale)
                    : "—"}
                </strong>
                <span style={{ width: "100px" }}>
                  <span
                    className={`status ${lead.status === "CONVERTED" ? "status-sent" : "status-draft"}`}
                  >
                    {leadStatusLabel(lead.status)}
                  </span>
                </span>
                <span style={{ width: "160px", textAlign: "right" }}>
                  {lead.status !== "CONVERTED" ? (
                    <button
                      type="button"
                      className="button button-primary"
                      onClick={() => handleConvertLead(lead.id)}
                      disabled={loading}
                      style={{ fontSize: "0.8rem", minHeight: "34px", padding: "0.3rem 0.6rem" }}
                    >
                      <Sparkles size={14} /> 1-Click Convert
                    </button>
                  ) : (
                    <span className="status status-sent">Converted ✓</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: CUSTOMER ACTIVITY FEED */}
      {activeTab === "feed" && (
        <div className="narrow-page" style={{ margin: "0 auto" }}>
          {initialActivities.length === 0 ? (
            <div className="empty-state">
              <h2 style={{ margin: 0, fontSize: "1.05rem" }}>No activity yet</h2>
              <p style={{ margin: "0.4rem 0 0" }}>
                Logged calls, emails, notes and meetings — plus automatic opportunity stage changes
                — appear here as a chronological interaction journal.
              </p>
            </div>
          ) : (
            <ol
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              {initialActivities.map((activity) => (
                <li
                  key={activity.id}
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    padding: "0.85rem 1rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "1rem",
                      alignItems: "baseline",
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{activity.subject}</span>
                    <span className="badge">{crmActivityTypeLabel(activity.type)}</span>
                  </div>
                  {activity.body ? (
                    <p style={{ margin: "0.4rem 0 0", color: "var(--muted)" }}>{activity.body}</p>
                  ) : null}
                  <time
                    style={{
                      display: "block",
                      marginTop: "0.4rem",
                      fontSize: "0.8rem",
                      color: "var(--muted)",
                    }}
                    dateTime={activity.occurredAt}
                  >
                    {new Date(activity.occurredAt).toLocaleString()}
                  </time>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {/* Modal for Lead Creation */}
      {isLeadModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "1rem",
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              borderRadius: "var(--radius)",
              padding: "2rem",
              maxWidth: "500px",
              width: "100%",
            }}
          >
            <div
              style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem" }}
            >
              <h2 style={{ margin: 0, fontSize: "1.3rem" }}>Create Sales Lead</h2>
              <button
                className="button button-quiet"
                type="button"
                onClick={() => setIsLeadModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setIsLeadModalOpen(false);
              }}
              className="form-stack"
            >
              <label className="field">
                <span>Lead Name</span>
                <input placeholder="e.g. John Doe" required />
              </label>
              <label className="field">
                <span>Company Name</span>
                <input placeholder="e.g. Acme Corp" />
              </label>
              <label className="field">
                <span>Email</span>
                <input type="email" placeholder="john@acme.com" />
              </label>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => setIsLeadModalOpen(false)}
                >
                  Cancel
                </button>
                <button className="button button-primary" type="submit">
                  Save Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal for Opportunity Creation */}
      {isOppModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "1rem",
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              borderRadius: "var(--radius)",
              padding: "2rem",
              maxWidth: "500px",
              width: "100%",
            }}
          >
            <div
              style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem" }}
            >
              <h2 style={{ margin: 0, fontSize: "1.3rem" }}>New Opportunity</h2>
              <button
                className="button button-quiet"
                type="button"
                onClick={() => setIsOppModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setIsOppModalOpen(false);
              }}
              className="form-stack"
            >
              <label className="field">
                <span>Deal Name</span>
                <input placeholder="e.g. Enterprise Cloud Migration" required />
              </label>
              <label className="field">
                <span>Estimated Deal Value (Minor Units)</span>
                <input type="number" placeholder="1500000" required />
              </label>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => setIsOppModalOpen(false)}
                >
                  Cancel
                </button>
                <button className="button button-primary" type="submit">
                  Create Opportunity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
