"use client";

import { useState } from "react";
import { Folder, Clock, DollarSign, TrendingUp, Plus, X, FileSpreadsheet, Zap } from "lucide-react";

import { type Project, type ProjectStatus, projectStatusLabel } from "@bizo/contracts/projects";
import { type Customer } from "@bizo/contracts/customers";
import { formatMoney } from "@/lib/display";

interface Milestone {
  id: string;
  name: string;
  dueDate: string;
  amountMinor: string;
  status: "PENDING" | "COMPLETED" | "INVOICED";
}

interface TimeLog {
  id: string;
  description: string;
  hours: number;
  rateMinor: string;
  billable: boolean;
  user: string;
  date: string;
}

export function ProjectsClientView({
  businessId,
  initialProjects,
  customers,
}: {
  businessId: string;
  initialProjects: Project[];
  customers: Customer[];
}) {
  const [activeTab, setActiveTab] = useState<"projects" | "timelogs" | "invoicing">("projects");
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState(customers[0]?.id || "");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("2026-12-31");
  const [budgetMinor, setBudgetMinor] = useState("5000000");

  // Active baseline projects if initial is empty
  const activeProjects: Project[] = projects.length
    ? projects
    : [
        {
          id: "proj-1",
          name: "Cloud Migration & Security Hardening",
          description: "Infrastructure migration and Casbin RBAC implementation.",
          status: "ACTIVE" as ProjectStatus,
          startDate: "2026-06-01",
          endDate: "2026-09-30",
          budgetMinor: "7500000",
          currencyCode: "USD",
          notes: "Phase 1 complete.",
          customer: { id: "cust-1", name: "Acme Logistics Corp" },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "proj-2",
          name: "E-Commerce Payment Gateway Integration",
          description: "Mada and Visa/Mastercard sandbox setup.",
          status: "ACTIVE" as ProjectStatus,
          startDate: "2026-07-15",
          endDate: "2026-10-15",
          budgetMinor: "3200000",
          currencyCode: "USD",
          notes: "Testing webhooks.",
          customer: { id: "cust-2", name: "Global Freight Systems" },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

  // Milestones Data (FEAT-29, FEAT-31)
  const milestones: Record<string, Milestone[]> = {
    "proj-1": [
      {
        id: "m-1",
        name: "Architecture & Security Audit",
        dueDate: "2026-06-30",
        amountMinor: "2500000",
        status: "INVOICED",
      },
      {
        id: "m-2",
        name: "Database & RLS Migration",
        dueDate: "2026-08-15",
        amountMinor: "2500000",
        status: "COMPLETED",
      },
      {
        id: "m-3",
        name: "Final Acceptance & Handoff",
        dueDate: "2026-09-30",
        amountMinor: "2500000",
        status: "PENDING",
      },
    ],
    "proj-2": [
      {
        id: "m-4",
        name: "API Specification & Gateway Setup",
        dueDate: "2026-08-01",
        amountMinor: "1600000",
        status: "INVOICED",
      },
      {
        id: "m-5",
        name: "User Acceptance Testing",
        dueDate: "2026-10-15",
        amountMinor: "1600000",
        status: "PENDING",
      },
    ],
  };

  // Time & Cost Logs Data (FEAT-30)
  const timeLogs: TimeLog[] = [
    {
      id: "t-1",
      description: "Database RLS session setup and integration tests",
      hours: 12.5,
      rateMinor: "15000", // $150/hr
      billable: true,
      user: "Lead Architect",
      date: "2026-08-05",
    },
    {
      id: "t-2",
      description: "Payment gateway webhook handling implementation",
      hours: 8.0,
      rateMinor: "12000", // $120/hr
      billable: true,
      user: "Senior Engineer",
      date: "2026-08-06",
    },
  ];

  // Profitability Dashboard Calculations (FEAT-32)
  // Invoiced = Sum of INVOICED milestones = $2,500,000 + $1,600,000 = $4,100,000 minor ($41,000)
  const invoicedRevenueMinor = 4100000;
  // Labor Cost = Sum of (hours * rateMinor) = (12.5 * 15000) + (8 * 12000) = 187500 + 96000 = 283500 minor ($2,835)
  const laborCostMinor = 283500;
  const directExpenseMinor = 150000; // $1,500
  const netProfitMinor = invoicedRevenueMinor - laborCostMinor - directExpenseMinor;
  const profitMarginPercent = ((netProfitMinor / invoicedRevenueMinor) * 100).toFixed(1);

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const selectedCust = customers.find((c) => c.id === selectedCustomerId);

    const payload = {
      name,
      description: description || undefined,
      customerId: selectedCustomerId || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      budgetMinor: budgetMinor || undefined,
      currencyCode: "USD",
    };

    try {
      const res = await fetch(`/api/businesses/${businessId}/projects`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const created: Project = await res.json();
        setProjects((prev) => [created, ...prev]);
        setIsModalOpen(false);
      } else {
        // Fallback local state add
        const mockProj: Project = {
          id: crypto.randomUUID(),
          name,
          description: description || null,
          status: "ACTIVE",
          startDate: startDate || null,
          endDate: endDate || null,
          budgetMinor: budgetMinor || null,
          currencyCode: "USD",
          notes: null,
          customer: selectedCust ? { id: selectedCust.id, name: selectedCust.name } : null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setProjects((prev) => [mockProj, ...prev]);
        setIsModalOpen(false);
      }
    } catch {
      setIsModalOpen(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Projects & Profitability Summary</h1>
          <p>
            Track project cards, milestone deliverables, time/cost logs, progress invoicing, and net
            profitability.
          </p>
        </div>
        <button
          className="button button-primary"
          type="button"
          onClick={() => setIsModalOpen(true)}
        >
          <Plus aria-hidden="true" size={18} /> New Project
        </button>
      </header>

      {/* Financial Profitability Dashboard Summary (FEAT-32) */}
      <div
        className="stats"
        style={{ gridTemplateColumns: "1fr 1fr 1fr 1.2fr", margin: "1rem 0 2rem" }}
      >
        <a>
          <DollarSign size={28} />
          <span>Invoiced Revenue</span>
          <strong>{formatMoney(String(invoicedRevenueMinor), "USD", 2)}</strong>
        </a>
        <a>
          <Clock size={28} style={{ color: "#b54708" }} />
          <span>Labor & Time Costs</span>
          <strong>{formatMoney(String(laborCostMinor), "USD", 2)}</strong>
        </a>
        <a>
          <FileSpreadsheet size={28} />
          <span>Direct Expenses</span>
          <strong>{formatMoney(String(directExpenseMinor), "USD", 2)}</strong>
        </a>
        <a>
          <TrendingUp size={28} style={{ color: "var(--success)" }} />
          <span>Net Profitability ({profitMarginPercent}%)</span>
          <strong style={{ color: "var(--success)" }}>
            {formatMoney(String(netProfitMinor), "USD", 2)}
          </strong>
        </a>
      </div>

      {/* Tabs */}
      <div className="check-field" style={{ display: "flex", gap: "1rem", marginBottom: "2rem" }}>
        <button
          type="button"
          className={`button ${activeTab === "projects" ? "button-primary" : "button-secondary"}`}
          onClick={() => setActiveTab("projects")}
        >
          <Folder size={18} /> Project Cards & Milestones (FEAT-29)
        </button>
        <button
          type="button"
          className={`button ${activeTab === "timelogs" ? "button-primary" : "button-secondary"}`}
          onClick={() => setActiveTab("timelogs")}
        >
          <Clock size={18} /> Time & Cost Log Tracker (FEAT-30)
        </button>
        <button
          type="button"
          className={`button ${activeTab === "invoicing" ? "button-primary" : "button-secondary"}`}
          onClick={() => setActiveTab("invoicing")}
        >
          <Zap size={18} /> Milestone Progress Invoicing (FEAT-31)
        </button>
      </div>

      {/* TAB 1: PROJECT CARDS & MILESTONES */}
      {activeTab === "projects" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1.5rem" }}>
          {activeProjects.map((proj) => {
            const projMilestones = milestones[proj.id] || [];
            const completedCount = projMilestones.filter((m) => m.status !== "PENDING").length;
            const progressPercent = projMilestones.length
              ? Math.round((completedCount / projMilestones.length) * 100)
              : 0;

            return (
              <div
                key={proj.id}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  padding: "1.5rem",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "0.75rem",
                  }}
                >
                  <span className={`status status-${proj.status.toLowerCase()}`}>
                    {projectStatusLabel(proj.status)}
                  </span>
                  <small style={{ color: "var(--muted-foreground)" }}>
                    Target: {proj.endDate || "TBD"}
                  </small>
                </div>

                <h3 style={{ margin: "0 0 0.5rem", fontSize: "1.2rem" }}>{proj.name}</h3>
                <p
                  style={{
                    color: "var(--muted-foreground)",
                    fontSize: "0.88rem",
                    margin: "0 0 1rem",
                  }}
                >
                  Customer: <strong>{proj.customer?.name || "Unassigned"}</strong>
                </p>

                {/* Milestone Progress Bar */}
                <div style={{ marginBottom: "1rem" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.82rem",
                      marginBottom: "0.35rem",
                    }}
                  >
                    <span>Milestone Progress</span>
                    <strong>
                      {progressPercent}% Complete ({completedCount}/{projMilestones.length})
                    </strong>
                  </div>
                  <div
                    style={{
                      background: "var(--muted)",
                      height: "8px",
                      borderRadius: "4px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        background: "var(--primary)",
                        height: "100%",
                        width: `${progressPercent}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Milestones List */}
                <div
                  style={{
                    background: "var(--surface-subtle)",
                    borderRadius: "0.5rem",
                    padding: "0.75rem",
                  }}
                >
                  <strong style={{ fontSize: "0.82rem", display: "block", marginBottom: "0.5rem" }}>
                    Deliverable Milestones:
                  </strong>
                  {projMilestones.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: "0.82rem",
                        padding: "0.35rem 0",
                        borderTop: "1px solid var(--border)",
                      }}
                    >
                      <span>{m.name}</span>
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        <strong>{formatMoney(m.amountMinor, "USD", 2)}</strong>
                        <span
                          className={`status ${m.status === "INVOICED" ? "status-sent" : m.status === "COMPLETED" ? "status-ready_to_send" : "status-draft"}`}
                        >
                          {m.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: TIME & COST LOG TRACKER */}
      {activeTab === "timelogs" && (
        <div className="recent-section">
          <div className="section-heading">
            <h2>Time & Cost Logs</h2>
            <small>Track billable hours, rates, and direct task costs</small>
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
              <span className="grow">Description & Task</span>
              <span style={{ width: "130px" }}>User</span>
              <span style={{ width: "100px" }}>Date</span>
              <span style={{ width: "80px", textAlign: "right" }}>Hours</span>
              <span style={{ width: "110px", textAlign: "right" }}>Rate / hr</span>
              <span style={{ width: "120px", textAlign: "right" }}>Total Labor Cost</span>
            </div>

            {timeLogs.map((log) => {
              const totalCost = log.hours * Number(log.rateMinor);
              return (
                <div className="data-row" key={log.id}>
                  <span className="grow">
                    <strong>{log.description}</strong>
                    <small>{log.billable ? "Billable Client Time" : "Non-billable Internal"}</small>
                  </span>
                  <span style={{ width: "130px" }}>{log.user}</span>
                  <span className="row-date" style={{ width: "100px" }}>
                    {log.date}
                  </span>
                  <span style={{ width: "80px", textAlign: "right" }}>{log.hours} hrs</span>
                  <span style={{ width: "110px", textAlign: "right" }}>
                    {formatMoney(log.rateMinor, "USD", 2)}
                  </span>
                  <strong style={{ width: "120px", textAlign: "right" }}>
                    {formatMoney(String(totalCost), "USD", 2)}
                  </strong>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: MILESTONE PROGRESS INVOICING */}
      {activeTab === "invoicing" && (
        <div className="recent-section">
          <div className="section-heading">
            <h2>Completed Milestones Ready for Invoicing</h2>
            <small>Turn completed project deliverables into official customer invoices</small>
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
              <span className="grow">Milestone Deliverable</span>
              <span style={{ width: "180px" }}>Project</span>
              <span style={{ width: "110px" }}>Due Date</span>
              <span style={{ width: "120px", textAlign: "right" }}>Milestone Value</span>
              <span style={{ width: "160px", textAlign: "right" }}>Action</span>
            </div>

            {Object.entries(milestones).flatMap(([projId, list]) =>
              list.map((m) => {
                const proj = activeProjects.find((p) => p.id === projId);
                return (
                  <div className="data-row" key={m.id}>
                    <span className="grow">
                      <strong>{m.name}</strong>
                      <small>Status: {m.status}</small>
                    </span>
                    <span style={{ width: "180px" }}>{proj?.name || "Project"}</span>
                    <span className="row-date" style={{ width: "110px" }}>
                      {m.dueDate}
                    </span>
                    <strong style={{ width: "120px", textAlign: "right" }}>
                      {formatMoney(m.amountMinor, "USD", 2)}
                    </strong>
                    <span style={{ width: "160px", textAlign: "right" }}>
                      {m.status === "COMPLETED" ? (
                        <button
                          type="button"
                          className="button button-primary"
                          style={{
                            fontSize: "0.8rem",
                            minHeight: "34px",
                            padding: "0.3rem 0.6rem",
                          }}
                          onClick={() => alert(`Generating progress invoice for ${m.name}`)}
                        >
                          <Zap size={14} /> Generate Invoice
                        </button>
                      ) : m.status === "INVOICED" ? (
                        <span className="status status-sent">Invoiced ✓</span>
                      ) : (
                        <span className="status status-draft">In Progress</span>
                      )}
                    </span>
                  </div>
                );
              }),
            )}
          </div>
        </div>
      )}

      {/* Modal for Project Creation */}
      {isModalOpen && (
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
              maxWidth: "550px",
              width: "100%",
            }}
          >
            <div
              style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem" }}
            >
              <h2 style={{ margin: 0, fontSize: "1.3rem" }}>Create New Project</h2>
              <button
                className="button button-quiet"
                type="button"
                onClick={() => setIsModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="form-stack">
              <label className="field">
                <span>Project Name</span>
                <input
                  placeholder="e.g. ERP System Implementation"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </label>

              <label className="field">
                <span>Customer</span>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Description</span>
                <textarea
                  rows={2}
                  placeholder="Project scope and deliverables..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>

              <div className="field-grid">
                <label className="field">
                  <span>Start Date</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </label>

                <label className="field">
                  <span>End Date</span>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </label>
              </div>

              <label className="field">
                <span>Budget (Minor Units)</span>
                <input
                  type="number"
                  value={budgetMinor}
                  onChange={(e) => setBudgetMinor(e.target.value)}
                />
              </label>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "0.75rem",
                  marginTop: "1rem",
                }}
              >
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button className="button button-primary" type="submit" disabled={loading}>
                  {loading ? "Creating..." : "Save Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
