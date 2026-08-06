import { z } from "zod";

const apiEnvironmentSchema = z
  .object({
    API_PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
    DATABASE_URL: z.url().startsWith("postgresql://"),
    INTERNAL_AUTH_SECRET: z.string().min(32),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    SMTP_FROM: z.email(),
    SMTP_URL: z
      .url()
      .refine(
        (value) => value.startsWith("smtp://") || value.startsWith("smtps://"),
        "SMTP_URL must use smtp:// or smtps://.",
      ),
    FRAPPE_API_KEY: z.string().min(1).optional(),
    FRAPPE_API_SECRET: z.string().min(1).optional(),
    FRAPPE_BASE_URL: z.url().optional(),
  })
  .superRefine((value, context) => {
    const configured = [
      value.FRAPPE_BASE_URL,
      value.FRAPPE_API_KEY,
      value.FRAPPE_API_SECRET,
    ].filter(Boolean).length;

    if (configured > 0 && configured < 3) {
      context.addIssue({
        code: "custom",
        message:
          "FRAPPE_BASE_URL, FRAPPE_API_KEY, and FRAPPE_API_SECRET must be configured together.",
      });
    }

    if (value.NODE_ENV === "production" && value.FRAPPE_BASE_URL?.startsWith("http://")) {
      context.addIssue({
        code: "custom",
        message: "FRAPPE_BASE_URL must use HTTPS in production.",
        path: ["FRAPPE_BASE_URL"],
      });
    }
  });

export type ApiEnvironment = z.infer<typeof apiEnvironmentSchema>;

export function readApiEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
): ApiEnvironment {
  return apiEnvironmentSchema.parse(environment);
}
