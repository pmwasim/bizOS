"use client";

import { useActionState } from "react";

import { type ActionState, createProjectAction } from "@/app/actions";
import { ActionMessage } from "@/components/action-message";
import { SubmitButton } from "@/components/submit-button";

interface CustomerOption {
  id: string;
  name: string;
}

export function ProjectForm({
  businessId,
  customers,
  defaultCustomerId,
}: {
  businessId: string;
  customers: CustomerOption[];
  defaultCustomerId?: string | undefined;
}) {
  const action = createProjectAction.bind(null, businessId);
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});

  return (
    <form action={formAction} className="form-stack">
      <ActionMessage error={state.error} />
      <label className="field">
        <span>Name</span>
        <input name="name" required minLength={1} autoFocus />
      </label>
      <label className="field">
        <span>
          Customer <em>Optional</em>
        </span>
        <select name="customerId" defaultValue={defaultCustomerId ?? ""}>
          <option value="">No customer</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>
          Description <em>Optional</em>
        </span>
        <textarea name="description" />
      </label>
      <div className="field-grid">
        <label className="field">
          <span>
            Start date <em>Optional</em>
          </span>
          <input name="startDate" type="date" />
        </label>
        <label className="field">
          <span>
            End date <em>Optional</em>
          </span>
          <input name="endDate" type="date" />
        </label>
      </div>
      <label className="field">
        <span>
          Budget <em>Optional</em>
        </span>
        <input name="budgetMinor" type="number" step="0.01" min="0" />
      </label>
      <label className="field">
        <span>
          Notes <em>Optional</em>
        </span>
        <textarea name="notes" />
      </label>
      <div className="form-actions">
        <SubmitButton pendingText="Saving project…">Create project</SubmitButton>
      </div>
    </form>
  );
}
