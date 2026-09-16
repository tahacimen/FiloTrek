"use server";

import * as demoService from "@/core/demo/demo-service";
import { toActionErrorMessage } from "@/lib/action-error";

export type DemoFormState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; error: string };

export async function submitDemoRequestAction(
  _prevState: DemoFormState,
  formData: FormData
): Promise<DemoFormState> {
  try {
    await demoService.createDemoRequest({
      fullName: formData.get("fullName"),
      companyName: formData.get("companyName"),
      phone: formData.get("phone"),
      email: formData.get("email"),
      vehicleCount: formData.get("vehicleCount"),
      message: formData.get("message"),
    });
    return { status: "success" };
  } catch (error) {
    return { status: "error", error: toActionErrorMessage(error) };
  }
}
