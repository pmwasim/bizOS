"use client";

import { useState } from "react";
import { Folder, Plus, X } from "lucide-react";

import { type Project, projectStatusLabel } from "@bizo/contracts/projects";
import { type Customer } from "@bizo/contracts/customers";
import { ActionMessage } from "@/components/action-message";
import { formatMoney } from "@/lib/display";

export function ProjectsClientView({
  businessId,
  initialProjects,
  customers,
}: {
  businessId: string;
  initialProjects: Project[];
  customers: Customer[];
}) {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  // Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState(customers[0]?.id || "");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("2026-12-31");
  const [budgetMinor, setBudgetMinor] = useState("5000000");

  // Milestones, time and cost logs, and project profitability are not derivable yet:
  // bizOS has no milestone, time-entry, or expense table, so there is nothing to total.
  // These were previously rendered from hard-coded arrays keyed to invented project ids.

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(undefined);

    const payload = {
      name,
      description: description || undefined,
      customerId: selectedCustomerId || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      budgetMinor: budgetMinor || undefined,
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
        return;
      }

      // The server rejected the project. Listing it anyway would show the business a
      // project, and a budget, that bizOS is not tracking.
      setError("The project could not be saved. Nothing was created.");
    } catch {
      setError("The project could not be saved — bizOS could not be reached.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Projects</h1>
          <p>The work you are delivering, who it is for, and what it is budgeted at.</p>
        </div>
        <button
          className="button button-primary"
          type="button"
          onClick={() => setIsModalOpen(true)}
        >
          <Plus aria-hidden="true" size={18} /> New Project
        </button>
      </header>

      <div className="stats" style={{ gridTemplateColumns: "1fr 1fr", margin: "1rem 0 2rem" }}>
        <a>
          <Folder size={28} />
          <span>Projects</span>
          <strong>{projects.length}</strong>
        </a>
        <a>
          <Folder size={28} />
          <span>Active</span>
          <strong>{projects.filter((project) => project.status === "ACTIVE").length}</strong>
        </a>
      </div>

      <div className="empty-state" style={{ marginBottom: "2rem" }}>
        <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Profitability is not tracked yet</h2>
        <p style={{ margin: "0.4rem 0 0" }}>
          bizOS records a project, its customer, its dates and its budget. It does not yet record
          milestones, time entries, or expenses, so revenue, labour cost and margin cannot be
          derived. Progress invoicing and profitability arrive with those records rather than being
          estimated from a budget.
        </p>
      </div>

      <div className="recent-section">
        <div className="section-heading">
          <h2>Projects</h2>
          <small>{projects.length} total</small>
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
            <span className="grow">Project</span>
            <span style={{ width: "180px" }}>Customer</span>
            <span style={{ width: "110px" }}>Status</span>
            <span style={{ width: "210px" }}>Dates</span>
            <span style={{ width: "130px", textAlign: "right" }}>Budget</span>
          </div>

          {projects.length === 0 && (
            <div className="data-row">
              <span className="grow">
                <strong>No projects yet</strong>
                <small>Create a project to track its customer, dates and budget.</small>
              </span>
            </div>
          )}

          {projects.map((project) => (
            <div className="data-row" key={project.id}>
              <span className="grow">
                <strong>{project.name}</strong>
                <small>{project.description || "No description provided"}</small>
              </span>
              <span style={{ width: "180px" }}>{project.customer?.name ?? "—"}</span>
              <span style={{ width: "110px" }}>
                <span
                  className={`status ${project.status === "ACTIVE" ? "status-sent" : "status-draft"}`}
                >
                  {projectStatusLabel(project.status)}
                </span>
              </span>
              <span style={{ width: "210px" }}>
                {project.startDate ?? "—"} to {project.endDate ?? "—"}
              </span>
              <strong style={{ width: "130px", textAlign: "right" }}>
                {project.budgetMinor
                  ? formatMoney(project.budgetMinor, project.currencyCode ?? "USD", 2)
                  : "—"}
              </strong>
            </div>
          ))}
        </div>
      </div>

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

            <ActionMessage error={error} />

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
