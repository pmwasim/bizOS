import { type Project } from "@bizo/contracts/projects";
import { type Customer } from "@bizo/contracts/customers";

import { apiJson } from "@/lib/api";
import { ProjectsClientView } from "@/components/projects-client-view";

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  let projects: Project[];
  let customers: Customer[];

  try {
    projects = await apiJson<Project[]>(`/businesses/${businessId}/projects`);
  } catch {
    projects = [];
  }

  try {
    customers = await apiJson<Customer[]>(`/businesses/${businessId}/customers`);
  } catch {
    customers = [];
  }

  return (
    <div className="page">
      <ProjectsClientView
        businessId={businessId}
        initialProjects={projects}
        customers={customers}
      />
    </div>
  );
}
