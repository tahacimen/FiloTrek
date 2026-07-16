"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { signIn } from "@/lib/auth";
import * as invitationService from "@/core/invitation/invitation-service";
import { toActionErrorMessage } from "@/lib/action-error";

export type InvitationAcceptFormState = { error?: string } | undefined;

export async function acceptInvitationAction(
  token: string,
  _prevState: InvitationAcceptFormState,
  formData: FormData
): Promise<InvitationAcceptFormState> {
  let email: string;
  try {
    const result = await invitationService.acceptInvitation(token, {
      companyName: formData.get("companyName"),
      fullName: formData.get("fullName"),
      password: formData.get("password"),
    });
    email = result.email;
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }

  try {
    await signIn("credentials", {
      email,
      password: formData.get("password"),
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      // Account was created successfully — only the auto-login hop failed
      // (shouldn't normally happen since we just set this password), so
      // send them to a normal login rather than reporting the whole thing
      // as an error.
      redirect("/login");
    }
    throw error;
  }

  // acceptInvitation only ever creates a COMPANY_USER, never a Driver/GateGuard
  // — no need for loginAction's account-type-dependent redirect target.
  redirect("/dashboard");
}
