import { z } from "zod";

const apiEnvironmentSchema = z.object({
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
});

export type ApiEnvironment = z.infer<typeof apiEnvironmentSchema>;

export function readApiEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
): ApiEnvironment {
  return apiEnvironmentSchema.parse(environment);
}
