import { z } from "zod";

export const createCustomerRequestSchema = z.strictObject({
  name: z.string().trim().min(2).max(200),
  email: z.email("Enter a valid email address.").max(320).nullable(),
  phone: z.string().trim().max(40).nullable(),
  addressLine1: z.string().trim().max(200).nullable().default(null),
  addressLine2: z.string().trim().max(200).nullable().default(null),
  city: z.string().trim().max(120).nullable().default(null),
  postalCode: z.string().trim().max(32).nullable().default(null),
  countryCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/)
    .nullable()
    .default(null),
});

export const customerSchema = createCustomerRequestSchema.extend({
  id: z.uuid(),
  createdAt: z.iso.datetime(),
});

export type CreateCustomerRequest = z.infer<typeof createCustomerRequestSchema>;
export type Customer = z.infer<typeof customerSchema>;
export type UpdateCustomerRequest = CreateCustomerRequest;
