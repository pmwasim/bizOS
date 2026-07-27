"use client";

import { useActionState } from "react";

import {
  type ActionState,
  archivePurchaseOrderAction,
  updateApprovalStatusAction,
  uploadApprovalEvidenceAction,
  uploadPurchaseOrderFileAction,
} from "@/app/actions";
import { ActionMessage } from "@/components/action-message";
import { SubmitButton } from "@/components/submit-button";

export function PurchaseOrderActions({
  businessId,
  purchaseOrderId,
  approvalStatus,
}: {
  businessId: string;
  purchaseOrderId: string;
  approvalStatus: string;
}) {
  const uploadPo = uploadPurchaseOrderFileAction.bind(null, businessId, purchaseOrderId);
  const uploadEvidence = uploadApprovalEvidenceAction.bind(null, businessId, purchaseOrderId);
  const updateApproval = updateApprovalStatusAction.bind(null, businessId, purchaseOrderId);
  const archive = archivePurchaseOrderAction.bind(null, businessId, purchaseOrderId);

  const [poState, poAction] = useActionState<ActionState, FormData>(uploadPo, {});
  const [evidenceState, evidenceAction] = useActionState<ActionState, FormData>(uploadEvidence, {});
  const [approvalState, approvalAction] = useActionState<ActionState, FormData>(updateApproval, {});
  const [archiveState, archiveAction] = useActionState<ActionState, FormData>(archive, {});

  return (
    <div className="stack-panels">
      <section className="panel">
        <h2>Customer PO file</h2>
        <p>Upload the purchase order PDF or image you received.</p>
        <form action={poAction} className="form-stack">
          <ActionMessage error={poState.error} />
          <label className="field">
            <span>PO file</span>
            <input
              name="file"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*"
              required
            />
          </label>
          <SubmitButton>Upload PO file</SubmitButton>
        </form>
      </section>

      <section className="panel">
        <h2>Invoice approval</h2>
        <p>Record whether the customer approved invoicing, then attach written evidence.</p>
        <form action={approvalAction} className="form-stack">
          <ActionMessage error={approvalState.error} />
          <label className="field">
            <span>Approval status</span>
            <select
              name="approvalStatus"
              defaultValue={approvalStatus === "NOT_RECORDED" ? "PENDING" : approvalStatus}
            >
              <option value="PENDING">Approval pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Declined</option>
            </select>
          </label>
          <SubmitButton>Save approval status</SubmitButton>
        </form>
        <form action={evidenceAction} className="form-stack" style={{ marginTop: "1rem" }}>
          <ActionMessage error={evidenceState.error} />
          <label className="field">
            <span>Approval evidence</span>
            <input
              name="file"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*"
              required
            />
          </label>
          <SubmitButton>Upload evidence</SubmitButton>
        </form>
      </section>

      <section className="panel danger-panel">
        <h2>Archive</h2>
        <p>Archiving hides this purchase order from readiness. Files stay on record.</p>
        <form
          action={archiveAction}
          className="form-stack"
          onSubmit={(event) => {
            if (!window.confirm("Archive this purchase order?")) {
              event.preventDefault();
            }
          }}
        >
          <ActionMessage error={archiveState.error} />
          <SubmitButton>Archive purchase order</SubmitButton>
        </form>
      </section>
    </div>
  );
}
