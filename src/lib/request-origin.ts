import { headers } from "next/headers";

/**
 * Mirrors the `trustHost: true` origin inference already used for Auth.js in
 * lib/auth.ts, instead of adding a separate base-URL env var that would need
 * to be kept in sync across dev/staging/prod on top of it.
 */
export async function getRequestOrigin(): Promise<string> {
  const headerList = await headers();
  const host =
    headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const proto =
    headerList.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
}
