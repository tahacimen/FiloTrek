"use server";

import { revalidatePath } from "next/cache";

import { requireTenantContext } from "@/core/shared/tenant-context";
import {
  createConsignee,
  removeConsignee,
  updateConsignee,
} from "@/core/consignee/consignee-service";
import { toActionErrorMessage } from "@/lib/action-error";

export type ConsigneeFormState = { error?: string } | undefined;

function readForm(formData: FormData) {
  return {
    title: formData.get("title"),
    province: formData.get("province"),
    district: formData.get("district"),
    address: formData.get("address"),
    phone: formData.get("phone"),
    taxNumber: formData.get("taxNumber"),
  };
}

export async function createConsigneeAction(
  _prevState: ConsigneeFormState,
  formData: FormData
): Promise<ConsigneeFormState> {
  try {
    const ctx = await requireTenantContext();
    await createConsignee(ctx, readForm(formData));
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath("/consignees");
  return undefined;
}

export async function updateConsigneeAction(
  id: string,
  _prevState: ConsigneeFormState,
  formData: FormData
): Promise<ConsigneeFormState> {
  try {
    const ctx = await requireTenantContext();
    await updateConsignee(ctx, id, readForm(formData));
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath("/consignees");
  return undefined;
}

export async function removeConsigneeAction(
  id: string
): Promise<ConsigneeFormState> {
  try {
    const ctx = await requireTenantContext();
    await removeConsignee(ctx, id);
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath("/consignees");
  return undefined;
}
