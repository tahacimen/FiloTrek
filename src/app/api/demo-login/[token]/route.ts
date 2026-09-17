import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { signIn } from "@/lib/auth";

/**
 * Time-limited sandbox demo login. Mirrors api/driver-login/[token]: signIn()
 * sets the session cookie, then we redirect to the company dashboard. An
 * invalid, revoked, or expired token (the "demo-token" provider refuses all
 * three) collapses to the same 404 as the other self-authenticating routes —
 * no signal to a prober about why it failed.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    await signIn("demo-token", { token, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      return new Response(null, { status: 404 });
    }
    throw error;
  }

  redirect("/dashboard");
}
