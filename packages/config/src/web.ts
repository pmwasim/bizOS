import { z } from "zod";

const webEnvironmentSchema = z.object({
  API_INTERNAL_URL: z.url().default("http://localhost:3001/api/v1"),
  AUTH_SECRET: z.string().min(32),
  INTERNAL_AUTH_SECRET: z.string().min(32),
});

export type WebEnvironment = z.infer<typeof webEnvironmentSchema>;

export function readWebEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
): WebEnvironment {
  return webEnvironmentSchema.parse(environment);
}
