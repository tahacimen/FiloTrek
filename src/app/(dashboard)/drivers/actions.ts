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
  revalidatePath("/drivers");
  return undefined;
}

export type DriverLoginLinkResult =
  | { url: string; phone: string; fullName: string; hasEmail: boolean }
  | { error: string };

/**
 * Issues a fresh login link and returns its URL so the dispatcher can share
 * it over free channels (WhatsApp / copy) — no e-mail required. Rotates the
 * token, so any previously shared link stops working.
 */
export async function getDriverLoginLinkAction(
  driverId: string
): Promise<DriverLoginLinkResult> {
  try {
    const ctx = await requireTenantContext();
    const { token, phone, fullName, email } =
      await driverService.issueDriverLoginToken(ctx, driverId);
    const origin = await getRequestOrigin();
    revalidatePath("/drivers");
    return {
      url: `${origin}/api/driver-login/${token}`,
      phone,
      fullName,
      hasEmail: Boolean(email),
    };
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
}

/** E-mails the driver's CURRENT link (no rotation) — used from the share dialog. */
export async function emailDriverLoginLinkAction(
  driverId: string
): Promise<DriverFormState> {
  try {
    const ctx = await requireTenantContext();
    const { token, email, fullName } =
      await driverService.getDriverLoginTokenInfo(ctx, driverId);
    if (!email) return { error: "Şoförün e-posta adresi tanımlı değil." };
    if (!token) return { error: "Önce bir bağlantı oluşturun." };
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

export async function revokeDriverLoginLinkAction(
  driverId: string
): Promise<DriverFormState> {
  try {
    const ctx = await requireTenantContext();
    await driverService.revokeDriverLoginLink(ctx, driverId);
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath("/drivers");
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
