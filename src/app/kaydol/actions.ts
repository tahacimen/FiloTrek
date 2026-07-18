"use server";

import * as signupService from "@/core/signup/signup-service";
import { toActionErrorMessage } from "@/lib/action-error";

export type SignupFormState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; error: string };

export async function submitSignupAction(
  _prevState: SignupFormState,
  formData: FormData
): Promise<SignupFormState> {
  try {
    await signupService.createSignupRequest({
      companyName: formData.get("companyName"),
      fullName: formData.get("fullName"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      role: formData.get("role"),
      message: formData.get("message"),
    });
    return { status: "success" };
  } catch (error) {
    return { status: "error", error: toActionErrorMessage(error) };
  }
}
