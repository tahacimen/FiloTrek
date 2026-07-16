"use server";

import { revalidatePath } from "next/cache";

import { requireTenantContext } from "@/core/shared/tenant-context";
import * as warehouseService from "@/core/warehouse/warehouse-service";
import { toActionErrorMessage } from "@/lib/action-error";

export type WarehouseFormState = { error?: string } | undefined;

export async function createWarehouseAction(
  _prevState: WarehouseFormState,
  formData: FormData
): Promise<WarehouseFormState> {
  try {
    const ctx = await requireTenantContext();
    await warehouseService.createWarehouse(ctx, {
      name: formData.get("name"),
    });
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath("/warehouses");
  return undefined;
}

/**
 * Dock forms carry nested/array data (working hours per day, supported
 * type lists) that doesn't map cleanly onto flat FormData.get() calls the
 * way the vehicle form's scalar fields do — the client dialog serializes
 * its whole state into a single hidden "payload" JSON field, which is
 * parsed here and handed straight to dockInputSchema (already expects a
 * structured object, not FormData).
 */
function readDockPayload(formData: FormData) {
  const raw = formData.get("payload");
  if (typeof raw !== "string") return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function createDockAction(
  warehouseId: string,
  _prevState: WarehouseFormState,
  formData: FormData
): Promise<WarehouseFormState> {
  try {
    const ctx = await requireTenantContext();
    await warehouseService.createDock(ctx, warehouseId, readDockPayload(formData));
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath("/warehouses");
  return undefined;
}

export async function updateDockAction(
  dockId: string,
  _prevState: WarehouseFormState,
  formData: FormData
): Promise<WarehouseFormState> {
  try {
    const ctx = await requireTenantContext();
    await warehouseService.updateDock(ctx, dockId, readDockPayload(formData));
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath("/warehouses");
  return undefined;
}
