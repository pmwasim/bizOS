import { z } from "zod";

export const healthResponseSchema = z.object({
  buildTime: z.iso.datetime().optional(),
  gitSha: z
    .string()
    .regex(/^[0-9a-f]{40}$/)
    .optional(),
  service: z.literal("api"),
  status: z.literal("ok"),
  timestamp: z.iso.datetime(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
