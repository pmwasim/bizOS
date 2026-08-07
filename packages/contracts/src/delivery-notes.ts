import { z } from "zod";

const decimalSchema = z
  .string()
  .trim()
  .regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/);

export const deliveryNoteStatusSchema = z.enum(["DRAFT", "DELIVERED", "CANCELLED"]);

export const deliveryNoteStatusLabelByCode = {
  DRAFT: "Draft",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
} as const satisfies Record<z.infer<typeof deliveryNoteStatusSchema>, string>;

export function deliveryNoteStatusLabel(status: z.infer<typeof deliveryNoteStatusSchema>): string {
  return deliveryNoteStatusLabelByCode[status];
}

export const deliveryNoteLineInputSchema = z.strictObject({
  description: z.string().trim().min(1).max(500),
  quantity: decimalSchema
    .refine((value) => !/^0(?:\.0+)?$/.test(value), "Quantity must be greater than zero.")
    .refine(
      (value) => !value.includes(".") || value.split(".")[1]!.length <= 6,
      "Use no more than 6 decimal places.",
    ),
});

export const createDeliveryNoteRequestSchema = z.strictObject({
  customerId: z.uuid(),
  salesOrderId: z.uuid().optional(),
  deliveryDate: z.iso.date().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  lines: z.array(deliveryNoteLineInputSchema).min(1).max(50),
});

export const updateDeliveryNoteRequestSchema = z.strictObject({
  deliveryDate: z.iso.date().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  lines: z.array(deliveryNoteLineInputSchema).min(1).max(50),
});

export const deliveryNoteLineSchema = z.strictObject({
  position: z.number().int().positive(),
  description: z.string(),
  quantity: z.string(),
});

export const deliveryNoteSchema = z.strictObject({
  id: z.uuid(),
  number: z.string(),
  status: deliveryNoteStatusSchema,
  deliveryDate: z.iso.date().nullable(),
  notes: z.string().nullable(),
  customer: z.strictObject({
    id: z.uuid(),
    name: z.string(),
    email: z.email().nullable(),
    phone: z.string().nullable(),
  }),
  salesOrder: z
    .strictObject({
      id: z.uuid(),
      number: z.string(),
    })
    .nullable(),
  lines: z.array(deliveryNoteLineSchema),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type DeliveryNoteStatus = z.infer<typeof deliveryNoteStatusSchema>;
export type DeliveryNote = z.infer<typeof deliveryNoteSchema>;
export type CreateDeliveryNoteRequest = z.infer<typeof createDeliveryNoteRequestSchema>;
export type UpdateDeliveryNoteRequest = z.infer<typeof updateDeliveryNoteRequestSchema>;
