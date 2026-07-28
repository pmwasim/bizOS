import {
  type SystemAdminConfigurationTemplateSummary,
  type SystemAdminWorkflowTemplateSummary,
} from "@bizo/contracts/system-admin";

import { apiJson } from "@/lib/api";

export default async function AdminTemplatesPage() {
  const [configurationTemplates, workflowTemplates] = await Promise.all([
    apiJson<SystemAdminConfigurationTemplateSummary[]>("/system-admin/configuration-templates"),
    apiJson<SystemAdminWorkflowTemplateSummary[]>("/system-admin/workflow-templates"),
  ]);

  return (
    <div className="page">
      <header className="page-heading">
        <h1>Templates</h1>
        <p>Configuration and workflow template versions available for assignment.</p>
      </header>

      <section className="admin-section">
        <h2>Configuration templates</h2>
        {configurationTemplates.length === 0 ? (
          <p className="admin-empty">No configuration templates.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Kind</th>
                <th>Version</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {configurationTemplates.flatMap((template) =>
                template.versions.map((version) => (
                  <tr key={version.id}>
                    <td>{template.code}</td>
                    <td>{template.name}</td>
                    <td>{template.kind}</td>
                    <td>{version.version}</td>
                    <td>{version.status}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        )}
      </section>

      <section className="admin-section">
        <h2>Workflow templates</h2>
        {workflowTemplates.length === 0 ? (
          <p className="admin-empty">No workflow templates.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Document type</th>
                <th>Version</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {workflowTemplates.flatMap((template) =>
                template.versions.map((version) => (
                  <tr key={version.id}>
                    <td>{template.code}</td>
                    <td>{template.name}</td>
                    <td>{template.documentType}</td>
                    <td>{version.version}</td>
                    <td>{version.status}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
