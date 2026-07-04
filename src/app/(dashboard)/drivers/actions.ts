"use server";

import { revalidatePath } from "next/cache";

import { requireTenantContext } from "@/core/shared/tenant-context";
import * as driverService from "@/core/driver/driver-service";
import * as notificationService from "@/core/notification/notification-service";
import { toActionErrorMessage } from "@/lib/action-error";
import { getRequestOrigin } from "@/lib/request-origin";

export type DriverFormState = { error?: string } | undefined;

/** Empty optional inputs arrive as "" in FormData, not absent — normalize to undefined. */
function optionalFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readDriverForm(formData: FormData) {
  return {
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    licenseNumber: formData.get("licenseNumber"),
    email: optionalFormString(formData, "email"),
    password: optionalFormString(formData, "password"),
    tcNumber: optionalFormString(formData, "tcNumber"),
    experienceYears: optionalFormString(formData, "experienceYears"),
  };
}

export async function createDriverAction(
  _prevState: DriverFormState,
  formData: FormData
): Promise<DriverFormState> {
  try {
    const ctx = await requireTenantContext();
    await driverService.createDriver(ctx, readDriverForm(formData));
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath("/drivers");
  revalidatePath("/dashboard");
  return undefined;
}

export async function updateDriverAction(
  driverId: string,
  _prevState: DriverFormState,
  formData: FormData
): Promise<DriverFormState> {
  try {
    const ctx = await requireTenantContext();
    await driverService.updateDriver(ctx, driverId, readDriverForm(formData));
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath("/drivers");
  return undefined;
}

export async function sendDriverLoginLinkAction(
  driverId: string
): Promise<DriverFormState> {
  try {
    const ctx = await requireTenantContext();
    const { token, email, fullName } =
      await driverService.regenerateDriverLoginToken(ctx, driverId);
    const origin = await getRequestOrigin();
    await notificationService.notifyDriverLoginLink({
      driverEmail: email,
      driverFullName: fullName,
      loginUrl: `${origin}/api/driver-login/${token}`,
    });
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  return undefined;
}

export async function deleteDriverAction(
  driverId: string
): Promise<DriverFormState> {
  try {
    const ctx = await requireTenantContext();
    await driverService.deleteDriver(ctx, driverId);
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath("/drivers");
  revalidatePath("/dashboard");
  return undefined;
}
