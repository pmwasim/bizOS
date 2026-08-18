"use client";

import { useActionState, useState } from "react";
import { Folder, Plus, X } from "lucide-react";

import { type Project, projectStatusLabel } from "@bizo/contracts/projects";
import { type Customer } from "@bizo/contracts/customers";
import { type ActionState, createProjectAction } from "@/app/actions";
import { ActionMessage } from "@/components/action-message";
import { SubmitButton } from "@/components/submit-button";
import { formatMoney } from "@/lib/display";

export function ProjectsClientView({
  businessId,
  initialProjects,
  customers,
  currency,
  currencyScale,
}: {
  businessId: string;
  initialProjects: Project[];
  customers: Customer[];
  currency: string;
  currencyScale: number;
}) {
  const projects = initialProjects;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [state, formAction] = useActionState<ActionState, FormData>(
    createProjectAction.bind(null, businessId),
    {},
  );

  // Milestones, time and cost logs, and project profitability are not derivable yet:
  // bizOS has no milestone, time-entry, or expense table, so there is nothing to total.
  // These were previously rendered from hard-coded arrays keyed to invented project ids.

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
                  ? formatMoney(
                      project.budgetMinor,
                      project.currencyCode ?? currency,
                      currencyScale,
                    )
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

            <ActionMessage error={state.error} />

            <form action={formAction} className="form-stack">
              <label className="field">
                <span>Project Name</span>
                <input name="name" placeholder="e.g. ERP System Implementation" required />
              </label>

              <label className="field">
                <span>Customer</span>
                <select name="customerId" defaultValue={customers[0]?.id ?? ""}>
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
                  name="description"
                  rows={2}
                  placeholder="Project scope and deliverables..."
                />
              </label>

              <div className="field-grid">
                <label className="field">
                  <span>Start Date</span>
                  <input
                    name="startDate"
                    type="date"
                    defaultValue={new Date().toISOString().slice(0, 10)}
                  />
                </label>

                <label className="field">
                  <span>End Date</span>
                  <input name="endDate" type="date" defaultValue="2026-12-31" />
                </label>
              </div>

              <label className="field">
                <span>Budget (Minor Units)</span>
                <input name="budgetMinor" type="number" defaultValue="5000000" />
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
                <SubmitButton pendingText="Creating...">Save Project</SubmitButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
