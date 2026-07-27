import { z } from "zod";

export const normalizedEmailSchema = z
  .email("Enter a valid email address.")
  .max(320)
  .transform((value) => value.trim().toLowerCase());

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(128, "Use no more than 128 characters.")
  .regex(/[a-z]/, "Add a lowercase letter.")
  .regex(/[A-Z]/, "Add an uppercase letter.")
  .regex(/[0-9]/, "Add a number.");

export const signUpRequestSchema = z.strictObject({
  displayName: z.string().trim().min(2).max(120),
  email: normalizedEmailSchema,
  password: passwordSchema,
});

export const verifyCredentialsRequestSchema = z.strictObject({
  email: normalizedEmailSchema,
  password: z.string().min(1).max(128),
});

export const authenticatedUserSchema = z.strictObject({
  id: z.uuid(),
  displayName: z.string(),
  email: normalizedEmailSchema,
  locale: z.string(),
});

export type AuthenticatedUser = z.infer<typeof authenticatedUserSchema>;
export type SignUpRequest = z.infer<typeof signUpRequestSchema>;
export type VerifyCredentialsRequest = z.infer<typeof verifyCredentialsRequestSchema>;
