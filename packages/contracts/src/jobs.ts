import { z } from "zod";

export const jobEnvelopeSchema = z.object({
  correlationId: z.uuid(),
  id: z.uuid(),
  name: z.string().min(1).max(120),
  occurredAt: z.iso.datetime(),
  payload: z.record(z.string(), z.unknown()),
  schemaVersion: z.number().int().positive(),
  tenantId: z.uuid(),
});

export type JobEnvelope = z.infer<typeof jobEnvelopeSchema>;
