import { z } from "zod";

export const statementLineTypeSchema = z.enum(["INVOICE", "PAYMENT"]);
export type StatementLineType = z.infer<typeof statementLineTypeSchema>;

export const statementLineItemSchema = z.object({
  id: z.string(),
  date: z.string(),
  type: statementLineTypeSchema,
  referenceNumber: z.string(),
  description: z.string(),
  debitMinor: z.number().int().nonnegative(),
  creditMinor: z.number().int().nonnegative(),
  balanceMinor: z.number().int(),
  currency: z.string().default("SAR"),
});

export type StatementLineItem = z.infer<typeof statementLineItemSchema>;

export const customerStatementSchema = z.object({
  customerId: z.string(),
  customerName: z.string(),
  currency: z.string(),
  openingBalanceMinor: z.number().int(),
  totalInvoicedMinor: z.number().int().nonnegative(),
  totalPaidMinor: z.number().int().nonnegative(),
  closingBalanceMinor: z.number().int(),
  items: z.array(statementLineItemSchema),
});

export type CustomerStatement = z.infer<typeof customerStatementSchema>;

export const statementQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export type StatementQuery = z.infer<typeof statementQuerySchema>;
