"use server";

import { revalidatePath } from "next/cache";

import { requireTenantContext } from "@/core/shared/tenant-context";
import {
  addDriverBlock,
  removeDriverBlock,
} from "@/core/driver-block/driver-block-service";
import { toActionErrorMessage } from "@/lib/action-error";

export type BlockFormState = { error?: string } | undefined;

export async function addDriverBlockAction(
  _prevState: BlockFormState,
  formData: FormData
): Promise<BlockFormState> {
  try {
    const ctx = await requireTenantContext();
    await addDriverBlock(ctx, {
      fullName: formData.get("fullName"),
      tcNumber: formData.get("tcNumber"),
      licenseNumber: formData.get("licenseNumber"),
      reason: formData.get("reason"),
    });
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath("/blocked-drivers");
  return undefined;
}

export async function removeDriverBlockAction(
  id: string
): Promise<BlockFormState> {
  try {
    const ctx = await requireTenantContext();
    await removeDriverBlock(ctx, id);
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath("/blocked-drivers");
  return undefined;
}
