import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { signIn } from "@/lib/auth";

/**
 * proxy.ts's matcher excludes /api/**, so this self-authenticates exactly
 * like api/uploads/[shipmentId]/[filename]/route.ts: signIn() itself sets
 * the session cookie (Route Handlers, like Server Actions, are allowed to
 * mutate cookies), then we redirect to /driver. An invalid or
 * already-rotated token collapses to the same 404 as every other
 * self-authenticating route here — no signal to a prober about why it
 * failed.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    await signIn("driver-token", { token, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      return new Response(null, { status: 404 });
    }
    throw error;
  }

  redirect("/driver");
}
