"use client";

import { useActionState } from "react";

import { type SystemAdminConfigurationTemplateSummary } from "@bizo/contracts/system-admin";

import { assignConfigurationAction, type SystemAdminActionState } from "@/app/actions";

export function AssignmentForm({
  businessId,
  templates,
}: {
  businessId: string;
  templates: SystemAdminConfigurationTemplateSummary[];
}) {
  const bound = assignConfigurationAction.bind(null, businessId);
  const [state, formAction, pending] = useActionState<SystemAdminActionState, FormData>(bound, {});

  const publishedVersions = templates.flatMap((template) =>
    template.versions
      .filter((version) => version.status === "PUBLISHED")
      .map((version) => ({
        value: version.id,
        label: `${template.code} v${version.version}`,
      })),
  );

  return (
    <form className="admin-form" action={formAction}>
      <div className="admin-field">
        <label htmlFor="configurationTemplateVersionId">Configuration version</label>
        <select id="configurationTemplateVersionId" name="configurationTemplateVersionId" required>
          <option value="">Select a published version…</option>
          {publishedVersions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
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
          placeholder="Explain why this assignment is changing (visible in the audit log)."
          rows={3}
        />
      </div>

      <div className="admin-field admin-field-check">
        <label>
          <input type="checkbox" name="confirm" />
          <span>
            I understand this demotes the current primary assignment and applies the new
            configuration immediately.
          </span>
        </label>
      </div>

      {state.error ? (
        <p className="admin-form-error" role="alert">
          {state.error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className="admin-submit">
        {pending ? "Applying…" : "Apply assignment"}
      </button>
    </form>
  );
}
