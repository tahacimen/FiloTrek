"use server";

import { revalidatePath } from "next/cache";

import { requireDriverContext } from "@/core/shared/driver-context";
import { advanceShipmentStatusAsDriver } from "@/core/shipment/shipment-status";
import {
  reportShipmentIncident,
  resolveShipmentIncidentAsDriver,
} from "@/core/shipment/shipment-incident";
import { toActionErrorMessage } from "@/lib/action-error";
import type { ShipmentStatus } from "@/generated/prisma/client";

export type DriverShipmentFormState = { error?: string } | undefined;

function revalidateShipmentPaths(shipmentId: string) {
  revalidatePath("/driver");
  revalidatePath("/shipments");
  revalidatePath(`/shipments/${shipmentId}`);
  revalidatePath("/vehicles");
  revalidatePath("/drivers");
  revalidatePath("/dashboard");
}

/**
 * A `<input type="file">` present in the DOM but with nothing picked
 * returns an empty (size: 0) File from FormData, never `null` — so
 * `!formData.get(...)` alone would never catch a missing file. The actual
 * "was a real photo attached" check lives in advanceShipmentStatusAsDriver
 * itself; this just narrows FormData's untyped FormDataEntryValue down to
 * File | undefined for it.
 */
function readPhoto(formData: FormData): File | undefined {
  const raw = formData.get("photo");
  return raw instanceof File ? raw : undefined;
}

export async function advanceShipmentStatusAsDriverAction(
  shipmentId: string,
  targetStatus: ShipmentStatus,
  _prevState: DriverShipmentFormState,
  formData: FormData
): Promise<DriverShipmentFormState> {
  const noteRaw = formData.get("note");
  const note =
    typeof noteRaw === "string" && noteRaw.length > 0 ? noteRaw : undefined;

  try {
    const driverCtx = await requireDriverContext();
    await advanceShipmentStatusAsDriver(driverCtx, {
      shipmentId,
      targetStatus,
      note,
      photo: readPhoto(formData),
    });
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidateShipmentPaths(shipmentId);
  return undefined;
}

export async function reportShipmentIncidentAction(
  shipmentId: string,
  _prevState: DriverShipmentFormState,
  formData: FormData
): Promise<DriverShipmentFormState> {
  const noteRaw = formData.get("note");
  const note =
    typeof noteRaw === "string" && noteRaw.length > 0 ? noteRaw : undefined;

  try {
    const driverCtx = await requireDriverContext();
    await reportShipmentIncident(driverCtx, {
      shipmentId,
      note,
      photo: readPhoto(formData),
    });
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidateShipmentPaths(shipmentId);
  return undefined;
}

export async function resolveShipmentIncidentAsDriverAction(
  shipmentId: string,
  _prevState: DriverShipmentFormState,
  formData: FormData
): Promise<DriverShipmentFormState> {
  const noteRaw = formData.get("resolutionNote");
  const resolutionNote =
    typeof noteRaw === "string" && noteRaw.length > 0 ? noteRaw : undefined;

  try {
    const driverCtx = await requireDriverContext();
    await resolveShipmentIncidentAsDriver(driverCtx, {
      shipmentId,
      resolutionNote,
    });
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidateShipmentPaths(shipmentId);
  return undefined;
}
