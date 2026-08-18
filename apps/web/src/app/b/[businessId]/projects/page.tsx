import { type Project } from "@bizo/contracts/projects";
import { type Customer } from "@bizo/contracts/customers";
import { type BusinessSettings } from "@bizo/contracts/platform";

import { apiJson } from "@/lib/api";
import { ProjectsClientView } from "@/components/projects-client-view";

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  const [projects, customers, settings] = await Promise.all([
    apiJson<Project[]>(`/businesses/${businessId}/projects`),
    apiJson<Customer[]>(`/businesses/${businessId}/customers`),
    apiJson<BusinessSettings>(`/businesses/${businessId}/settings`),
  ]);

  return (
    <div className="page">
      <ProjectsClientView
        businessId={businessId}
        initialProjects={projects}
        customers={customers}
        currency={settings.baseCurrency}
        currencyScale={settings.currencyScale}
      />
    </div>
  );
}
