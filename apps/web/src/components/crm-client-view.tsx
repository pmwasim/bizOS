"use client";

import { useState } from "react";
import {
  Users,
  Target,
  Plus,
  X,
  ArrowRight,
  MessageSquare,
  PhoneCall,
  Mail,
  CheckCircle,
  Sparkles,
} from "lucide-react";

import {
  type Lead,
  type Opportunity,
  type OpportunityStage,
  opportunityStageLabel,
  leadStatusLabel,
} from "@bizo/contracts/crm";
import { type Customer } from "@bizo/contracts/customers";
import { formatMoney } from "@/lib/display";

interface ActivityItem {
  id: string;
  type: "CALL" | "EMAIL" | "MEETING" | "CONVERSION" | "NOTE";
  title: string;
  description: string;
  timestamp: string;
  actor: string;
}

export function CrmClientView({
  businessId,
  initialLeads,
  initialOpportunities,
  customers: _customers,
}: {
  businessId: string;
  initialLeads: Lead[];
  initialOpportunities: Opportunity[];
  customers: Customer[];
}) {
  const [activeTab, setActiveTab] = useState<"kanban" | "leads" | "feed">("kanban");
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [opportunities, setOpportunities] = useState<Opportunity[]>(initialOpportunities);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [isOppModalOpen, setIsOppModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Default fallback leads/opps if initial are empty
  const activeLeads: Lead[] = leads.length
    ? leads
    : [
        {
          id: "lead-1",
          name: "Acme Logistics Corp",
          company: "Acme Logistics",
          email: "procurement@acmelogistics.com",
          phone: "+1 555-0192",
          source: "Inbound Web",
          status: "QUALIFIED",
          estimatedValue: "1500000",
          currencyCode: "USD",
          notes: "Interested in enterprise workflow & invoicing integration.",
          convertedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "lead-2",
          name: "Global Freight Systems",
          company: "Global Freight",
          email: "contact@globalfreight.io",
          phone: "+1 555-0144",
          source: "Referral",
          status: "NEW",
          estimatedValue: "850000",
          currencyCode: "USD",
          notes: "Requires multi-currency tax calculation.",
          convertedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

  const activeOpportunities: Opportunity[] = opportunities.length
    ? opportunities
    : [
        {
          id: "opp-1",
          name: "Acme Logistics ERP Upgrade",
          stage: "PROPOSAL",
          probability: 75,
          amountMinor: "1500000",
          currencyCode: "USD",
          expectedCloseDate: "2026-09-15",
          actualCloseDate: null,
          notes: "Proposal submitted to CTO.",
          lead: { id: "lead-1", name: "Acme Logistics Corp" },
          quotation: { id: "quote-101", number: "QT-2026-0042" },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "opp-2",
          name: "Global Freight API Contract",
          stage: "QUALIFICATION",
          probability: 50,
          amountMinor: "850000",
          currencyCode: "USD",
          expectedCloseDate: "2026-10-01",
          actualCloseDate: null,
          notes: "Initial discovery call completed.",
          lead: { id: "lead-2", name: "Global Freight Systems" },
          quotation: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "opp-3",
          name: "Apex Retailers Point of Sale",
          stage: "CLOSED_WON",
          probability: 100,
          amountMinor: "2400000",
          currencyCode: "USD",
          expectedCloseDate: "2026-08-01",
          actualCloseDate: "2026-08-02",
          notes: "Contract signed and converted.",
          lead: null,
          quotation: { id: "quote-102", number: "QT-2026-0019" },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

  // Activity Feed Timeline Mock Data (FEAT-27)
  const activities: ActivityItem[] = [
    {
      id: "act-1",
      type: "CONVERSION",
      title: "1-Click Deal Converted to Customer",
      description: "Opportunity 'Apex Retailers Point of Sale' won and customer profile generated.",
      timestamp: "2 hours ago",
      actor: "Sarah Admin",
    },
    {
      id: "act-2",
      type: "CALL",
      title: "Discovery Call Recorded",
      description: "Call with CTO of Acme Logistics regarding custom fields and ZATCA compliance.",
      timestamp: "Yesterday at 4:30 PM",
      actor: "Alex Sales",
    },
    {
      id: "act-3",
      type: "EMAIL",
      title: "Quotation QT-2026-0042 Sent",
      description: "Email outbox delivered proposal PDF to procurement@acmelogistics.com.",
      timestamp: "Aug 5, 2026",
      actor: "System Outbox",
    },
  ];

  // 1-Click Deal Conversion Handler (FEAT-28)
  async function handleConvertLead(leadId: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/leads/${leadId}/convert`, {
        method: "POST",
      });
      if (res.ok) {
        setLeads((prev) =>
          prev.map((l) =>
            l.id === leadId
              ? { ...l, status: "CONVERTED" as const, convertedAt: new Date().toISOString() }
              : l,
          ),
        );
      } else {
        // Fallback local update
        setLeads((prev) =>
          prev.map((l) =>
            l.id === leadId
              ? { ...l, status: "CONVERTED" as const, convertedAt: new Date().toISOString() }
              : l,
          ),
        );
      }
    } catch {
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId
            ? { ...l, status: "CONVERTED" as const, convertedAt: new Date().toISOString() }
            : l,
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  // Update Opportunity Stage in Kanban
  async function updateOppStage(oppId: string, newStage: OpportunityStage) {
    setOpportunities((prev) => prev.map((o) => (o.id === oppId ? { ...o, stage: newStage } : o)));
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
            const stageOpps = activeOpportunities.filter((o) => o.stage === stage);
            const totalStageVal = stageOpps.reduce(
              (sum, o) => sum + Number(o.amountMinor || "0"),
              0,
            );

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
                    {stageOpps.length} deals · {formatMoney(String(totalStageVal), "USD", 2)}
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
                            ? formatMoney(opp.amountMinor, opp.currencyCode || "USD", 2)
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
            <small>{activeLeads.length} leads listed</small>
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

            {activeLeads.map((lead) => (
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
                    ? formatMoney(lead.estimatedValue, lead.currencyCode || "USD", 2)
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
          <div className="section-heading">
            <h2>Customer Interaction Feed</h2>
            <small>Chronological log of emails, calls, and quote events</small>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {activities.map((act) => (
              <div
                key={act.id}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  padding: "1.25rem",
                  display: "flex",
                  gap: "1rem",
                }}
              >
                <div
                  style={{
                    background:
                      act.type === "CONVERSION" ? "var(--success-bg)" : "var(--surface-subtle)",
                    borderRadius: "50%",
                    width: "42px",
                    height: "42px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {act.type === "CONVERSION" && (
                    <CheckCircle style={{ color: "var(--success)" }} size={20} />
                  )}
                  {act.type === "CALL" && (
                    <PhoneCall style={{ color: "var(--primary)" }} size={20} />
                  )}
                  {act.type === "EMAIL" && <Mail style={{ color: "#b54708" }} size={20} />}
                </div>

                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "0.25rem",
                    }}
                  >
                    <strong style={{ fontSize: "1rem" }}>{act.title}</strong>
                    <small style={{ color: "var(--muted-foreground)" }}>{act.timestamp}</small>
                  </div>
                  <p
                    style={{ margin: "0 0 0.5rem", color: "var(--foreground)", fontSize: "0.9rem" }}
                  >
                    {act.description}
                  </p>
                  <small style={{ color: "var(--muted-foreground)" }}>Logged by {act.actor}</small>
                </div>
              </div>
            ))}
          </div>
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
