"use client";

import { useActionState } from "react";

import { type SystemAdminConfigurationTemplateSummary } from "@bizo/contracts/system-admin";

import { setDefaultErpVersionAction, type SystemAdminActionState } from "@/app/actions";

export function DefaultErpForm({
  templates,
}: {
  templates: SystemAdminConfigurationTemplateSummary[];
}) {
  const [state, formAction, pending] = useActionState<SystemAdminActionState, FormData>(
    setDefaultErpVersionAction,
    {},
  );

  const defaultErpTemplate = templates.find((template) => template.code === "default-erp");
  const publishedVersions =
    defaultErpTemplate?.versions.filter((version) => version.status === "PUBLISHED") ?? [];

  return (
    <form className="admin-form" action={formAction}>
      <div className="admin-field">
        <label htmlFor="configurationTemplateVersionId">Default ERP version</label>
        <select id="configurationTemplateVersionId" name="configurationTemplateVersionId" required>
          <option value="">Select a published default-erp version…</option>
          {publishedVersions.map((version) => (
            <option key={version.id} value={version.id}>
              v{version.version}
            </option>
          ))}
        </select>
      </div>

      <div className="admin-field">
        <label htmlFor="reason">Reason</label>
        <textarea
          id="reason"
          name="reason"
          required
          maxLength={500}
          placeholder="Explain why the platform default is changing (visible in the audit log)."
          rows={3}
        />
      </div>

      <div className="admin-field admin-field-check">
        <label>
          <input type="checkbox" name="confirm" />
          <span>
            I understand this changes the platform default ERP version for new onboarding
            recommendations.
          </span>
        </label>
      </div>

      {state.error ? (
        <p className="admin-form-error" role="alert">
          {state.error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className="admin-submit">
        {pending ? "Applying…" : "Set platform default"}
      </button>
    </form>
  );
}
