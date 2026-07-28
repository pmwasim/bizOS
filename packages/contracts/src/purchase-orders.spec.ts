import { describe, expect, it } from "vitest";

import {
  bestReadiness,
  derivePurchaseOrderReadiness,
  readinessLabelByCode,
} from "./purchase-orders.js";

describe("purchase order readiness", () => {
  it("requires approval evidence and a linked quotation for ready to invoice", () => {
    const ready = derivePurchaseOrderReadiness({
      status: "ACTIVE",
      approvalStatus: "APPROVED",
      hasApprovalEvidence: true,
      hasPoFile: true,
      quotationLinked: true,
    });
    expect(ready.code).toBe("READY_TO_INVOICE");
    expect(ready.label).toBe(readinessLabelByCode.READY_TO_INVOICE);
  });

  it("surfaces approval evidence missing before ready", () => {
    expect(
      derivePurchaseOrderReadiness({
        status: "ACTIVE",
        approvalStatus: "APPROVED",
        hasApprovalEvidence: false,
        hasPoFile: true,
        quotationLinked: true,
      }).code,
    ).toBe("APPROVAL_EVIDENCE_MISSING");
  });

  it("picks the best readiness among linked purchase orders", () => {
    const best = bestReadiness([
      derivePurchaseOrderReadiness({
        status: "ACTIVE",
        approvalStatus: "PENDING",
        hasApprovalEvidence: false,
        hasPoFile: false,
        quotationLinked: true,
      }),
      derivePurchaseOrderReadiness({
        status: "ACTIVE",
        approvalStatus: "APPROVED",
        hasApprovalEvidence: true,
        hasPoFile: true,
        quotationLinked: true,
      }),
    ]);
    expect(best.code).toBe("READY_TO_INVOICE");
  });

  it("reports missing customer PO when none exist", () => {
    expect(bestReadiness([]).code).toBe("MISSING_CUSTOMER_PO");
  });
});
