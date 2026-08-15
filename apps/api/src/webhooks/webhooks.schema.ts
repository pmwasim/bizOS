import { z } from "zod";

export const createWebhookRequestSchema = z.strictObject({
  url: z.url().max(512),
  events: z.array(z.string()).max(20),
});
