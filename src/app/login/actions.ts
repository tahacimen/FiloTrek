"use server";

import { AuthError } from "next-auth";
import { getToken } from "next-auth/jwt";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { signIn } from "@/lib/auth";

export async function loginAction(
  callbackUrl: string,
  _prevState: string | undefined,
  formData: FormData
) {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return "E-posta veya şifre hatalı.";
    }
    throw error;
  }

  // Redirect target depends on account type (driver vs. company user), so
  // we can't hand next-auth a fixed redirectTo. We also can't just call
  // auth() here: its no-arg overload rebuilds its request from
  // next/headers' headers(), a read-only snapshot of the INCOMING request,
  // so it never sees the Set-Cookie signIn() just wrote via the mutable
  // cookies() jar — it would report the pre-login session. Decoding the
  // fresh cookie directly avoids that, and (more importantly) avoids ever
  // redirecting to the wrong page first and relying on proxy.ts to correct
  // it on a second hop — a Server Action redirect() whose own target gets
  // redirected again by middleware renders the second hop's content while
  // leaving the browser's address bar on the first hop's URL.
  const cookieHeader = (await cookies())
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  const token = await getToken({
    req: { headers: new Headers({ cookie: cookieHeader }) },
    secret: process.env.AUTH_SECRET,
  });
  const defaultTarget =
    token?.accountType === "DRIVER"
      ? "/driver"
      : token?.accountType === "GATE_GUARD"
        ? "/gate"
        : "/dashboard";
  redirect(callbackUrl || defaultTarget);
}
