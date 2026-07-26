import { z } from "zod";

const infrastructureEnvironmentSchema = z.object({
  DATABASE_URL: z.url().startsWith("postgresql://"),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_ACCOUNT_ID: z.string().min(1),
  R2_BUCKET: z.string().min(3),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  REDIS_URL: z.url().startsWith("redis://"),
});

export type InfrastructureEnvironment = z.infer<typeof infrastructureEnvironmentSchema>;

export function readInfrastructureEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
): InfrastructureEnvironment {
  return infrastructureEnvironmentSchema.parse(environment);
}
