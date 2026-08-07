"use client";

import { useActionState } from "react";

import { type ActionState, createInventoryItemAction } from "@/app/actions";
import { ActionMessage } from "@/components/action-message";
import { SubmitButton } from "@/components/submit-button";

export function InventoryItemForm({ businessId }: { businessId: string }) {
  const action = createInventoryItemAction.bind(null, businessId);
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});

  return (
    <form action={formAction} className="form-stack">
      <ActionMessage error={state.error} />
      <div className="field-grid">
        <label className="field">
          <span>SKU</span>
          <input name="sku" required minLength={1} autoFocus />
        </label>
        <label className="field">
          <span>Name</span>
          <input name="name" required minLength={1} />
        </label>
      </div>
      <label className="field">
        <span>
          Description <em>Optional</em>
        </span>
        <textarea name="description" />
      </label>
      <div className="field-grid">
        <label className="field">
          <span>Item type</span>
          <select name="itemType" defaultValue="INVENTORY">
            <option value="INVENTORY">Inventory</option>
            <option value="SERVICE">Service</option>
            <option value="NON_INVENTORY">Non-inventory</option>
          </select>
        </label>
        <label className="field">
          <span>
            Unit <em>Optional</em>
          </span>
          <input name="unit" placeholder="each, kg, hour…" />
        </label>
      </div>
      <div className="field-grid">
        <label className="field">
          <span>
            Cost price <em>Optional</em>
          </span>
          <input name="costPriceMinor" type="number" step="0.01" min="0" />
        </label>
        <label className="field">
          <span>
            Selling price <em>Optional</em>
          </span>
          <input name="sellingPriceMinor" type="number" step="0.01" min="0" />
        </label>
      </div>
      <label className="field">
        <span>
          Reorder level <em>Optional</em>
        </span>
        <input name="reorderLevel" type="number" min="0" step="1" />
      </label>
      <div className="form-actions">
        <SubmitButton pendingText="Saving item…">Add item</SubmitButton>
      </div>
    </form>
  );
}
