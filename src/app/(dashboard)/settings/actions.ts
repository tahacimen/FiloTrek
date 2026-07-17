"use server";

import { revalidatePath } from "next/cache";

import { requireTenantContext } from "@/core/shared/tenant-context";
import * as companyService from "@/core/company/company-service";
import { toActionErrorMessage } from "@/lib/action-error";

export type SettingsFormState = { error?: string; secret?: string } | undefined;

function optionalFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export async function generateApiKeyAction(): Promise<SettingsFormState> {
  let secret: string;
  try {
    const ctx = await requireTenantContext();
    secret = await companyService.generateApiKey(ctx);
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath("/settings");
  return { secret };
}

export async function setWebhookUrlAction(
  _prevState: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  try {
    const ctx = await requireTenantContext();
    await companyService.setWebhookUrl(ctx, {
      webhookUrl: optionalFormString(formData, "webhookUrl"),
    });
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath("/settings");
  return undefined;
}

export async function generateWebhookSecretAction(): Promise<SettingsFormState> {
  let secret: string;
  try {
    const ctx = await requireTenantContext();
    secret = await companyService.generateWebhookSecret(ctx);
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath("/settings");
  return { secret };
}
