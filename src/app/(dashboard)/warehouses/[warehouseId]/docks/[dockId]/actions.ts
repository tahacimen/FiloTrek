"use server";

import { revalidatePath } from "next/cache";

import { requireTenantContext } from "@/core/shared/tenant-context";
import * as dockReservationService from "@/core/warehouse/dock-reservation-service";
import {
  cancelReservation,
  markCompleted,
  markVehicleArrived,
} from "@/core/warehouse/dock-reservation-status";
import { toActionErrorMessage } from "@/lib/action-error";

export type ReservationFormState = { error?: string } | undefined;

function readReservationPayload(formData: FormData) {
  const raw = formData.get("payload");
  if (typeof raw !== "string") return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function createReservationAction(
  warehouseId: string,
  dockId: string,
  _prevState: ReservationFormState,
  formData: FormData
): Promise<ReservationFormState> {
  try {
    const ctx = await requireTenantContext();
    await dockReservationService.createReservation(
      ctx,
      dockId,
      readReservationPayload(formData)
    );
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath(`/warehouses/${warehouseId}/docks/${dockId}`);
  return undefined;
}

export async function markVehicleArrivedAction(
  warehouseId: string,
  dockId: string,
  reservationId: string
): Promise<ReservationFormState> {
  try {
    const ctx = await requireTenantContext();
    await markVehicleArrived(ctx, reservationId);
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath(`/warehouses/${warehouseId}/docks/${dockId}`);
  return undefined;
}

export async function markCompletedAction(
  warehouseId: string,
  dockId: string,
  reservationId: string
): Promise<ReservationFormState> {
  try {
    const ctx = await requireTenantContext();
    await markCompleted(ctx, reservationId);
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath(`/warehouses/${warehouseId}/docks/${dockId}`);
  return undefined;
}

export async function cancelReservationAction(
  warehouseId: string,
  dockId: string,
  reservationId: string
): Promise<ReservationFormState> {
  try {
    const ctx = await requireTenantContext();
    await cancelReservation(ctx, reservationId);
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath(`/warehouses/${warehouseId}/docks/${dockId}`);
  return undefined;
}
