import { randomBytes } from "node:crypto";

/** 32 random bytes, URL-safe — long enough to be unguessable as a bearer credential. */
export function generateLoginToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Same generation as generateLoginToken, under a neutral name for non-login secrets (API keys, webhook secrets). */
export function generateSecureToken(): string {
  return randomBytes(32).toString("base64url");
}
