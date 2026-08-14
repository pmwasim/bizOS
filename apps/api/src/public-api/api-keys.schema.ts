import { z } from "zod";

export const createApiKeyRequestSchema = z.strictObject({
  name: z.string().trim().min(1).max(120),
  scopes: z.array(z.string()).max(20),
});
