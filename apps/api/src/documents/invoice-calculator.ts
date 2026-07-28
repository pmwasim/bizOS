import { type UpdateInvoiceRequest } from "@bizo/contracts/invoices";

import { calculateQuotation, type CalculatedQuotation } from "./quotation-calculator.js";

export type CalculatedInvoice = CalculatedQuotation;

export function calculateInvoice(
  input: Pick<UpdateInvoiceRequest, "lines">,
  currencyScale: number,
): CalculatedInvoice {
  return calculateQuotation(
    {
      customerId: "00000000-0000-4000-8000-000000000000",
      lines: input.lines,
    },
    currencyScale,
  );
}
