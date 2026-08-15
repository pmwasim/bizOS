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

/**
 * 32 random bytes, base64url-encoded, so 43 characters with no padding. The API only ever stores
 * the SHA-256 hash of this value; the raw token exists in the reset email and nowhere else.
 */
export const passwordResetTokenSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/, "That password reset link is not valid.");

export const requestPasswordResetRequestSchema = z.strictObject({
  email: normalizedEmailSchema,
});

export const confirmPasswordResetRequestSchema = z.strictObject({
  token: passwordResetTokenSchema,
  password: passwordSchema,
});

/**
 * Requesting a reset always reports the same result whether or not the address has an account, so
 * the endpoint cannot be used to discover which emails are registered.
 */
export const passwordResetAcceptedSchema = z.strictObject({
  status: z.literal("accepted"),
});

export const authenticatedUserSchema = z.strictObject({
  id: z.uuid(),
  displayName: z.string(),
  email: normalizedEmailSchema,
  locale: z.string(),
});

export type AuthenticatedUser = z.infer<typeof authenticatedUserSchema>;
export type ConfirmPasswordResetRequest = z.infer<typeof confirmPasswordResetRequestSchema>;
export type PasswordResetAccepted = z.infer<typeof passwordResetAcceptedSchema>;
export type RequestPasswordResetRequest = z.infer<typeof requestPasswordResetRequestSchema>;
export type SignUpRequest = z.infer<typeof signUpRequestSchema>;
export type VerifyCredentialsRequest = z.infer<typeof verifyCredentialsRequestSchema>;
