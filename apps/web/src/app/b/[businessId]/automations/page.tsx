import { type WorkflowTemplate } from "@bizo/contracts/workflows";

import { apiJson } from "@/lib/api";
import { AutomationsClientView } from "@/components/automations-client-view";

export default async function AutomationsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  let templates: WorkflowTemplate[];

  try {
    templates = await apiJson<WorkflowTemplate[]>(`/businesses/${businessId}/workflows/templates`);
  } catch {
    templates = [];
  }

  return (
    <div className="page">
      <AutomationsClientView businessId={businessId} initialTemplates={templates} />
    </div>
  );
}
