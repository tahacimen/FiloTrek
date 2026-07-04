"use server";

import { revalidatePath } from "next/cache";

import { requireTenantContext } from "@/core/shared/tenant-context";
import * as gateGuardService from "@/core/gate-guard/gate-guard-service";
import { toActionErrorMessage } from "@/lib/action-error";

export type GateGuardFormState = { error?: string } | undefined;

/** Empty optional inputs arrive as "" in FormData, not absent — normalize to undefined. */
function optionalFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readGateGuardForm(formData: FormData) {
  return {
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: optionalFormString(formData, "password"),
  };
}

export async function createGateGuardAction(
  _prevState: GateGuardFormState,
  formData: FormData
): Promise<GateGuardFormState> {
  try {
    const ctx = await requireTenantContext();
    await gateGuardService.createGateGuard(ctx, readGateGuardForm(formData));
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath("/gate-guards");
  return undefined;
}

export async function updateGateGuardAction(
  gateGuardId: string,
  _prevState: GateGuardFormState,
  formData: FormData
): Promise<GateGuardFormState> {
  try {
    const ctx = await requireTenantContext();
    await gateGuardService.updateGateGuard(
      ctx,
      gateGuardId,
      readGateGuardForm(formData)
    );
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath("/gate-guards");
  return undefined;
}

export async function deleteGateGuardAction(
  gateGuardId: string
): Promise<GateGuardFormState> {
  try {
    const ctx = await requireTenantContext();
    await gateGuardService.deleteGateGuard(ctx, gateGuardId);
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath("/gate-guards");
  return undefined;
}
