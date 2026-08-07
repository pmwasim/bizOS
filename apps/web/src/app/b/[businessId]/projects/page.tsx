import { Plus, Folder } from "lucide-react";
import Link from "next/link";

import { projectStatusLabel, type Project } from "@bizo/contracts/projects";

import { apiJson } from "@/lib/api";
import { formatMinor } from "@/lib/display";

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const projects = await apiJson<Project[]>(`/businesses/${businessId}/projects`);
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Projects</h1>
          <p>Track jobs, milestones, and budgets.</p>
        </div>
        <Link className="button button-primary" href={`/b/${businessId}/projects/new`}>
          <Plus aria-hidden="true" size={18} /> New project
        </Link>
      </header>
      {projects.length ? (
        <div className="data-list">
          {projects.map((project) => (
            <div className="data-row" key={project.id}>
              <span className="avatar">{project.name.slice(0, 1).toUpperCase()}</span>
              <span className="grow">
                <strong>{project.name}</strong>
                <small>
                  {projectStatusLabel(project.status)} &middot;{" "}
                  {project.customer ? project.customer.name : "No customer"}
                </small>
              </span>
              {project.budgetMinor ? (
                <strong>
                  {formatMinor(project.budgetMinor, 2, project.currencyCode ?? "USD")}
                </strong>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Folder aria-hidden="true" size={30} />
          <h2>No projects yet</h2>
          <p>Create projects to track work and budgets.</p>
        </div>
      )}
    </div>
  );
}
