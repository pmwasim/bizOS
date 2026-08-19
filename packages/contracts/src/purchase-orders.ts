import { z } from "zod";

import { supplierBillSchema, type SupplierBill } from "./supplier-bills.js";

export const invoiceApprovalStatusSchema = z.enum([
  "NOT_RECORDED",
  "PENDING",
  "APPROVED",
  "REJECTED",
]);

export const purchaseOrderStatusSchema = z.enum(["ACTIVE", "ARCHIVED"]);

export const readinessCodeSchema = z.enum([
  "MISSING_CUSTOMER_PO",
  "PO_RECORDED",
  "APPROVAL_PENDING",
  "APPROVAL_EVIDENCE_MISSING",
  "READY_TO_INVOICE",
  "NOT_READY_REJECTED",
  "CUSTOMER_PO_OPTIONAL",
]);

export const readinessLabelByCode = {
  MISSING_CUSTOMER_PO: "Missing customer PO",
  PO_RECORDED: "PO recorded",
  APPROVAL_PENDING: "Approval pending",
  APPROVAL_EVIDENCE_MISSING: "Approval evidence missing",
  READY_TO_INVOICE: "Ready to invoice",
  NOT_READY_REJECTED: "Not ready (approval declined)",
  CUSTOMER_PO_OPTIONAL: "Customer PO optional",
} as const satisfies Record<z.infer<typeof readinessCodeSchema>, string>;

export const readinessSchema = z.strictObject({
  code: readinessCodeSchema,
  label: z.string().min(1).max(80),
  explanation: z.string().min(1).max(400),
});

export type InvoiceApprovalStatus = z.infer<typeof invoiceApprovalStatusSchema>;
export type PurchaseOrderStatus = z.infer<typeof purchaseOrderStatusSchema>;
export type ReadinessCode = z.infer<typeof readinessCodeSchema>;
export type Readiness = z.infer<typeof readinessSchema>;

export interface ReadinessInput {
  approvalStatus: InvoiceApprovalStatus;
  hasApprovalEvidence: boolean;
  hasPoFile: boolean;
  quotationLinked: boolean;
  status: PurchaseOrderStatus;
}

const readinessRank: Record<ReadinessCode, number> = {
  READY_TO_INVOICE: 50,
  CUSTOMER_PO_OPTIONAL: 45,
  APPROVAL_EVIDENCE_MISSING: 40,
  APPROVAL_PENDING: 30,
  NOT_READY_REJECTED: 30,
  PO_RECORDED: 20,
  MISSING_CUSTOMER_PO: 10,
};

export interface QuotationInvoiceReadinessInput {
  customerPoRequired: boolean;
  purchaseOrderReadiness: Readiness;
  quotationStatus: string;
}

export function canCreateInvoiceFromQuotation(input: QuotationInvoiceReadinessInput): boolean {
  if (input.customerPoRequired) {
    return input.purchaseOrderReadiness.code === "READY_TO_INVOICE";
  }
  if (input.purchaseOrderReadiness.code === "READY_TO_INVOICE") {
    return true;
  }
  return input.quotationStatus === "SENT";
}

export function derivePurchaseOrderReadiness(input: ReadinessInput): Readiness {
  if (input.status === "ARCHIVED") {
    return {
      code: "MISSING_CUSTOMER_PO",
      label: readinessLabelByCode.MISSING_CUSTOMER_PO,
      explanation: "This purchase order is archived and does not count toward invoicing.",
    };
  }

  if (input.approvalStatus === "REJECTED") {
    return {
      code: "NOT_READY_REJECTED",
      label: readinessLabelByCode.NOT_READY_REJECTED,
      explanation: "Invoice approval was declined. Update approval when the customer confirms.",
    };
  }

  if (input.approvalStatus === "APPROVED") {
    if (!input.hasApprovalEvidence) {
      return {
        code: "APPROVAL_EVIDENCE_MISSING",
        label: readinessLabelByCode.APPROVAL_EVIDENCE_MISSING,
        explanation: "Approval is recorded, but upload written approval evidence to continue.",
      };
    }
    if (!input.quotationLinked) {
      return {
        code: "PO_RECORDED",
        label: readinessLabelByCode.PO_RECORDED,
        explanation: "Link this purchase order to a quotation before it is ready to invoice.",
      };
    }
    return {
      code: "READY_TO_INVOICE",
      label: readinessLabelByCode.READY_TO_INVOICE,
      explanation:
        "A customer PO is linked, approval is recorded, and approval evidence is on file.",
    };
  }

  if (input.approvalStatus === "NOT_RECORDED" || input.approvalStatus === "PENDING") {
    return {
      code: "APPROVAL_PENDING",
      label: readinessLabelByCode.APPROVAL_PENDING,
      explanation: input.hasPoFile
        ? "Record whether invoice approval has been received."
        : "Record the PO details, then record invoice approval when available.",
    };
  }

  return {
    code: "PO_RECORDED",
    label: readinessLabelByCode.PO_RECORDED,
    explanation: "A purchase order is on file.",
  };
}

export function bestReadiness(
  items: Readiness[],
  options?: { customerPoRequired?: boolean },
): Readiness {
  if (items.length === 0) {
    if (options?.customerPoRequired === false) {
      return {
        code: "CUSTOMER_PO_OPTIONAL",
        label: readinessLabelByCode.CUSTOMER_PO_OPTIONAL,
        explanation:
          "A customer purchase order is optional for this configuration. You can create an invoice from a sent quotation.",
      };
    }
    return {
      code: "MISSING_CUSTOMER_PO",
      label: readinessLabelByCode.MISSING_CUSTOMER_PO,
      explanation: "Add a customer purchase order and link it to this quotation.",
    };
  }
  return items.reduce((best, current) =>
    readinessRank[current.code] >= readinessRank[best.code] ? current : best,
  );
}

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => value ?? null);

export const createPurchaseOrderRequestSchema = z
  .strictObject({
    customerId: z.uuid(),
    quotationId: z.uuid().nullable().optional().default(null),
    poNumber: z.string().trim().min(1).max(80),
    poDate: z.iso.date().nullable().optional().default(null),
    projectReference: optionalTrimmed(120),
    amountMinor: z.string().regex(/^\d+$/).nullable().optional().default(null),
    currencyCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/)
      .nullable()
      .optional()
      .default(null),
    currencyScale: z.number().int().min(0).max(6).nullable().optional().default(null),
    notes: optionalTrimmed(2000),
  })
  .superRefine((value, ctx) => {
    const hasAmount = value.amountMinor !== null;
    const hasCurrency = value.currencyCode !== null;
    const hasScale = value.currencyScale !== null;
    if (hasAmount || hasCurrency || hasScale) {
      if (!(hasAmount && hasCurrency && hasScale)) {
        ctx.addIssue({
          code: "custom",
          message: "Amount, currency, and currency scale must be provided together.",
          path: ["amountMinor"],
        });
      }
    }
  });

export const updatePurchaseOrderRequestSchema = z
  .strictObject({
    quotationId: z.uuid().nullable().optional(),
    poNumber: z.string().trim().min(1).max(80).optional(),
    poDate: z.iso.date().nullable().optional(),
    projectReference: optionalTrimmed(120).optional(),
    amountMinor: z.string().regex(/^\d+$/).nullable().optional(),
    currencyCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/)
      .nullable()
      .optional(),
    currencyScale: z.number().int().min(0).max(6).nullable().optional(),
    notes: optionalTrimmed(2000).optional(),
  })
  .superRefine((value, ctx) => {
    const amountProvided = Object.hasOwn(value, "amountMinor");
    const currencyProvided = Object.hasOwn(value, "currencyCode");
    const scaleProvided = Object.hasOwn(value, "currencyScale");
    if (amountProvided || currencyProvided || scaleProvided) {
      const amountMinor = value.amountMinor ?? null;
      const currencyCode = value.currencyCode ?? null;
      const currencyScale = value.currencyScale ?? null;
      const clearing = amountMinor === null && currencyCode === null && currencyScale === null;
      const complete = amountMinor !== null && currencyCode !== null && currencyScale !== null;
      if (!clearing && !complete) {
        ctx.addIssue({
          code: "custom",
          message: "Amount, currency, and currency scale must be provided together.",
          path: ["amountMinor"],
        });
      }
    }
  });

export const updateApprovalStatusRequestSchema = z.strictObject({
  approvalStatus: z.enum(["PENDING", "APPROVED", "REJECTED"]),
});

export const storedObjectSchema = z.strictObject({
  id: z.uuid(),
  kind: z.enum(["PURCHASE_ORDER", "APPROVAL_EVIDENCE"]),
  originalFilename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(120),
  byteSize: z.number().int().positive(),
  checksumSha256: z.string().length(64),
  createdAt: z.iso.datetime(),
});

export const purchaseOrderSchema = z.strictObject({
  id: z.uuid(),
  status: purchaseOrderStatusSchema,
  poNumber: z.string().min(1).max(80),
  poDate: z.iso.date().nullable(),
  projectReference: z.string().max(120).nullable(),
  amountMinor: z.string().nullable(),
  currencyCode: z.string().length(3).nullable(),
  currencyScale: z.number().int().nullable(),
  notes: z.string().max(2000).nullable(),
  customer: z.strictObject({
    id: z.uuid(),
    name: z.string(),
  }),
  quotation: z
    .strictObject({
      id: z.uuid(),
      number: z.string(),
    })
    .nullable(),
  approvalStatus: invoiceApprovalStatusSchema,
  approvalChangedAt: z.iso.datetime().nullable(),
  poFile: storedObjectSchema.nullable(),
  approvalEvidence: storedObjectSchema.nullable(),
  readiness: readinessSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

/**
 * One-click conversion of an APPROVED customer purchase order into a draft supplier bill takes no
 * request body — the source purchase order id is the path parameter and every bill field is derived
 * from it. The empty strict object documents that contract and rejects stray fields. The response is
 * the created (or already-existing, on a repeat convert) draft supplier bill.
 */
export const convertPurchaseOrderToBillRequestSchema = z.strictObject({});
export const convertPurchaseOrderToBillResponseSchema = supplierBillSchema;

export type ConvertPurchaseOrderToBillRequest = z.infer<
  typeof convertPurchaseOrderToBillRequestSchema
>;
export type ConvertPurchaseOrderToBillResponse = SupplierBill;

export type CreatePurchaseOrderRequest = z.infer<typeof createPurchaseOrderRequestSchema>;
export type UpdatePurchaseOrderRequest = z.infer<typeof updatePurchaseOrderRequestSchema>;
export type UpdateApprovalStatusRequest = z.infer<typeof updateApprovalStatusRequestSchema>;
export type PurchaseOrder = z.infer<typeof purchaseOrderSchema>;
export type StoredObjectSummary = z.infer<typeof storedObjectSchema>;
