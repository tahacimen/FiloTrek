"use server";

import { revalidatePath } from "next/cache";

import { requireTenantContext } from "@/core/shared/tenant-context";
import * as vehicleService from "@/core/vehicle/vehicle-service";
import { setVehicleMaintenance } from "@/core/vehicle/vehicle-status";
import { toActionErrorMessage } from "@/lib/action-error";

export type VehicleFormState = { error?: string } | undefined;

function readVehicleForm(formData: FormData) {
  return {
    plate: formData.get("plate"),
    vehicleType: formData.get("vehicleType"),
    bedType: formData.get("bedType"),
    tonnageCapacity: formData.get("tonnageCapacity"),
  };
}

export async function createVehicleAction(
  _prevState: VehicleFormState,
  formData: FormData
): Promise<VehicleFormState> {
  try {
    const ctx = await requireTenantContext();
    await vehicleService.createVehicle(ctx, readVehicleForm(formData));
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath("/vehicles");
  revalidatePath("/dashboard");
  return undefined;
}

export async function updateVehicleAction(
  vehicleId: string,
  _prevState: VehicleFormState,
  formData: FormData
): Promise<VehicleFormState> {
  try {
    const ctx = await requireTenantContext();
    await vehicleService.updateVehicle(ctx, vehicleId, readVehicleForm(formData));
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath("/vehicles");
  return undefined;
}

export async function deleteVehicleAction(
  vehicleId: string
): Promise<VehicleFormState> {
  try {
    const ctx = await requireTenantContext();
    await vehicleService.deleteVehicle(ctx, vehicleId);
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath("/vehicles");
  revalidatePath("/dashboard");
  return undefined;
}

export async function toggleVehicleMaintenanceAction(
  vehicleId: string,
  inMaintenance: boolean
): Promise<VehicleFormState> {
  try {
    const ctx = await requireTenantContext();
    await setVehicleMaintenance(ctx, vehicleId, inMaintenance);
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath("/vehicles");
  revalidatePath("/dashboard");
  return undefined;
}
