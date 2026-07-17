import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";

import { signWebhookPayload } from "@/lib/webhook-signing";

describe("signWebhookPayload", () => {
  it("returns the HMAC-SHA256 hex digest of the body under the given secret", () => {
    const body = JSON.stringify({ hello: "world" });
    const signature = signWebhookPayload(body, "test-secret");

    const expected = createHmac("sha256", "test-secret").update(body).digest("hex");
    expect(signature).toBe(expected);
  });

  it("produces a different signature for a different secret", () => {
    const body = JSON.stringify({ hello: "world" });
    expect(signWebhookPayload(body, "secret-a")).not.toBe(
      signWebhookPayload(body, "secret-b")
    );
  });

  it("produces a different signature for a different body", () => {
    const secret = "same-secret";
    expect(signWebhookPayload("body-a", secret)).not.toBe(
      signWebhookPayload("body-b", secret)
    );
  });
});
