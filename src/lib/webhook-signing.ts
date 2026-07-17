import { createHmac } from "node:crypto";

/** HMAC-SHA256 hex digest of the raw request body, sent in the X-Logigo-Signature header for outbound webhooks. */
export function signWebhookPayload(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}
