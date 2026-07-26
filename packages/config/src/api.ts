import { z } from "zod";

const apiEnvironmentSchema = z.object({
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type ApiEnvironment = z.infer<typeof apiEnvironmentSchema>;

export function readApiEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
): ApiEnvironment {
  return apiEnvironmentSchema.parse(environment);
}
