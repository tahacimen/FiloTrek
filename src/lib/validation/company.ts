import { z } from "zod";

/** Company's own outbound webhook endpoint (see /settings, webhook-dispatch.ts). Empty clears it. */
export const webhookUrlInputSchema = z.object({
  webhookUrl: z
    .httpUrl("Geçerli bir URL girin.")
    .max(2000, "URL çok uzun.")
    .optional(),
});
export type WebhookUrlInput = z.infer<typeof webhookUrlInputSchema>;
