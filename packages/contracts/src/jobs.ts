import { z } from "zod";

export const jobEnvelopeSchema = z.object({
  correlationId: z.string().uuid(),
  id: z.string().uuid(),
  name: z.string().min(1).max(120),
  occurredAt: z.string().datetime(),
  payload: z.record(z.string(), z.unknown()),
  schemaVersion: z.number().int().positive(),
  tenantId: z.string().uuid(),
});

export type JobEnvelope = z.infer<typeof jobEnvelopeSchema>;
