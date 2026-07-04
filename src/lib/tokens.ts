import { randomBytes } from "node:crypto";

/** 32 random bytes, URL-safe — long enough to be unguessable as a bearer credential. */
export function generateLoginToken(): string {
  return randomBytes(32).toString("base64url");
}
