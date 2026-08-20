import {
  DEFAULT_NUMBER_PAD_WIDTH,
  type DocumentNumberingType,
  formatDocumentNumber,
} from "@bizo/contracts/numbering";
import { type Prisma } from "@bizo/database";

// Gap-safe, race-safe document number allocation.
//
// Every document type draws from its own counter column on `business_settings`. Allocation is a
// single `businessSettings.update` with an atomic `{ increment: 1 }`, which Prisma compiles to
// `UPDATE business_settings SET next_x = next_x + 1 WHERE business_id = $1 RETURNING …`. That one
// statement takes a row-level lock on the business's settings row, so two transactions allocating
// the same document type at the same time serialise on that lock and each receives a distinct,
// consecutive value — no two documents can ever share a number. Because the allocation runs inside
// the caller's transaction, a rolled-back document rolls back its counter bump too.

interface NumberingFields {
  /** Prisma field holding the configured prefix for this document type. */
  readonly prefix: string;
  /** Prisma field holding the next sequence value for this document type. */
  readonly next: string;
}

/** Whitelisted mapping of document type to its `business_settings` counter/prefix fields. */
const NUMBERING_FIELDS: Record<DocumentNumberingType, NumberingFields> = {
  QUOTATION: { prefix: "quotationPrefix", next: "nextQuotationNumber" },
  INVOICE: { prefix: "invoicePrefix", next: "nextInvoiceNumber" },
  SALES_ORDER: { prefix: "salesOrderPrefix", next: "nextSalesOrderNumber" },
  DELIVERY_NOTE: { prefix: "deliveryNotePrefix", next: "nextDeliveryNoteNumber" },
  CREDIT_NOTE: { prefix: "creditNotePrefix", next: "nextCreditNoteNumber" },
  PURCHASE_ORDER: { prefix: "purchaseOrderPrefix", next: "nextPurchaseOrderNumber" },
  SUPPLIER_PO: { prefix: "supplierPoPrefix", next: "nextSupplierPoNumber" },
  SUPPLIER_BILL: { prefix: "supplierBillPrefix", next: "nextSupplierBillNumber" },
  PAYMENT: { prefix: "paymentPrefix", next: "nextPaymentNumber" },
};

export interface AllocatedNumber {
  /** The formatted document number, e.g. `INV-0001`. */
  readonly number: string;
  /** The 1-based ordinal allocated for this document. */
  readonly sequence: number;
  /** The configured prefix that was applied. */
  readonly prefix: string;
  /** The zero-padding width that was applied. */
  readonly padWidth: number;
  /** The raw settings row returned by the atomic update, including any `extraSelect` fields. */
  readonly settings: Record<string, unknown>;
}

/**
 * Atomically allocate the next number for `type` on `businessId`, within the caller's transaction.
 *
 * `extraSelect` lets a caller pull additional settings columns (e.g. `invoiceDueDays`) from the same
 * atomic update instead of issuing a second read.
 */
export async function allocateDocumentNumber(
  tx: Prisma.TransactionClient,
  businessId: bigint,
  type: DocumentNumberingType,
  extraSelect: Record<string, true> = {},
): Promise<AllocatedNumber> {
  const fields = NUMBERING_FIELDS[type];
  const settings = (await tx.businessSettings.update({
    where: { businessId },
    data: { [fields.next]: { increment: 1 } } as unknown as Prisma.BusinessSettingsUpdateInput,
    select: {
      [fields.prefix]: true,
      [fields.next]: true,
      numberPadWidth: true,
      ...extraSelect,
    } as unknown as Prisma.BusinessSettingsSelect,
  })) as unknown as Record<string, unknown>;

  const nextValue = Number(settings[fields.next]);
  const prefix = String(settings[fields.prefix]);
  const padWidth = Number(settings.numberPadWidth ?? DEFAULT_NUMBER_PAD_WIDTH);
  // The atomic update returns the counter *after* the bump; the allocated ordinal is one less.
  const sequence = nextValue - 1;

  return {
    number: formatDocumentNumber(prefix, sequence, padWidth),
    sequence,
    prefix,
    padWidth,
    settings,
  };
}
