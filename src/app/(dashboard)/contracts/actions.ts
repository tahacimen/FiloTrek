"use server";

import { revalidatePath } from "next/cache";

import { requireTenantContext } from "@/core/shared/tenant-context";
import {
  createContractRate,
  removeContractRate,
  updateContractRate,
} from "@/core/contract/contract-service";
import { toActionErrorMessage } from "@/lib/action-error";

export type ContractFormState = { error?: string } | undefined;

function readForm(formData: FormData) {
  return {
    customerCompanyId: formData.get("customerCompanyId"),
    method: formData.get("method"),
    destinationProvince: formData.get("destinationProvince"),
    destinationDistrict: formData.get("destinationDistrict"),
    amount: formData.get("amount"),
  };
}

export async function createContractRateAction(
  _prevState: ContractFormState,
  formData: FormData
): Promise<ContractFormState> {
  try {
    const ctx = await requireTenantContext();
    await createContractRate(ctx, readForm(formData));
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath("/contracts");
  return undefined;
}

export async function updateContractRateAction(
  id: string,
  _prevState: ContractFormState,
  formData: FormData
): Promise<ContractFormState> {
  try {
    const ctx = await requireTenantContext();
    await updateContractRate(ctx, id, readForm(formData));
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath("/contracts");
  return undefined;
}

export async function removeContractRateAction(
  id: string
): Promise<ContractFormState> {
  try {
    const ctx = await requireTenantContext();
    await removeContractRate(ctx, id);
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath("/contracts");
  return undefined;
}
