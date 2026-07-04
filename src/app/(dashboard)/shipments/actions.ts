"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireTenantContext } from "@/core/shared/tenant-context";
import * as shipmentService from "@/core/shipment/shipment-service";
import {
  advanceShipmentStatus,
  cancelShipment,
} from "@/core/shipment/shipment-status";
import { resolveShipmentIncidentAsDispatcher } from "@/core/shipment/shipment-incident";
import { toActionErrorMessage } from "@/lib/action-error";
import type { ShipmentStatus } from "@/generated/prisma/client";

export type ShipmentFormState = { error?: string } | undefined;

/** Empty optional inputs arrive as "" in FormData, not absent — normalize to undefined. */
function optionalFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export async function createShipmentAction(
  _prevState: ShipmentFormState,
  formData: FormData
): Promise<ShipmentFormState> {
  let shipmentId: string;
  try {
    const ctx = await requireTenantContext();
    const shipment = await shipmentService.createShipment(ctx, {
      customerCompanyId: formData.get("customerCompanyId"),
      originAddress: formData.get("originAddress"),
      destinationAddress: formData.get("destinationAddress"),
      distanceKm: formData.get("distanceKm"),
      tonnage: formData.get("tonnage"),
      cargoDescription: optionalFormString(formData, "cargoDescription"),
    });
    shipmentId = shipment.id;
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath("/shipments");
  revalidatePath("/assign");
  revalidatePath("/dashboard");
  redirect(`/shipments/${shipmentId}`);
}

export async function createShipmentRequestAction(
  _prevState: ShipmentFormState,
  formData: FormData
): Promise<ShipmentFormState> {
  let shipmentId: string;
  try {
    const ctx = await requireTenantContext();
    const shipment = await shipmentService.createShipmentRequest(ctx, {
      supplierCompanyId: formData.get("supplierCompanyId"),
      originAddress: formData.get("originAddress"),
      destinationAddress: formData.get("destinationAddress"),
      distanceKm: formData.get("distanceKm"),
      tonnage: formData.get("tonnage"),
      cargoDescription: optionalFormString(formData, "cargoDescription"),
      documentTrackingNumber: optionalFormString(
        formData,
        "documentTrackingNumber"
      ),
      originMapsUrl: optionalFormString(formData, "originMapsUrl"),
      destinationMapsUrl: optionalFormString(formData, "destinationMapsUrl"),
    });
    shipmentId = shipment.id;
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath("/shipments");
  revalidatePath("/assign");
  revalidatePath("/dashboard");
  redirect(`/shipments/${shipmentId}`);
}

export async function markLoadReadyAction(
  shipmentId: string,
  _prevState: ShipmentFormState,
  formData: FormData
): Promise<ShipmentFormState> {
  try {
    const ctx = await requireTenantContext();
    await shipmentService.markLoadReady(ctx, shipmentId, {
      pickupGateInfo: formData.get("pickupGateInfo"),
      pickupMapsUrl: optionalFormString(formData, "pickupMapsUrl"),
    });
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath(`/shipments/${shipmentId}`);
  revalidatePath("/shipments");
  revalidatePath("/dashboard");
  return undefined;
}

export async function setPickupEtaAction(
  shipmentId: string,
  _prevState: ShipmentFormState,
  formData: FormData
): Promise<ShipmentFormState> {
  try {
    const ctx = await requireTenantContext();
    await shipmentService.setPickupEta(ctx, shipmentId, {
      estimatedPickupArrivalAt: formData.get("estimatedPickupArrivalAt"),
    });
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath(`/shipments/${shipmentId}`);
  revalidatePath("/shipments");
  return undefined;
}

export async function approvePriceAction(
  shipmentId: string
): Promise<ShipmentFormState> {
  try {
    const ctx = await requireTenantContext();
    await shipmentService.approvePrice(ctx, shipmentId);
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath(`/shipments/${shipmentId}`);
  revalidatePath("/shipments");
  return undefined;
}

export async function proposePriceAction(
  shipmentId: string,
  _prevState: ShipmentFormState,
  formData: FormData
): Promise<ShipmentFormState> {
  try {
    const ctx = await requireTenantContext();
    await shipmentService.proposePrice(ctx, shipmentId, {
      amount: formData.get("amount"),
    });
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath(`/shipments/${shipmentId}`);
  revalidatePath("/shipments");
  return undefined;
}

export async function rejectPriceAction(
  shipmentId: string,
  _prevState: ShipmentFormState,
  formData: FormData
): Promise<ShipmentFormState> {
  try {
    const ctx = await requireTenantContext();
    await shipmentService.rejectPrice(ctx, shipmentId, {
      counterAmount: optionalFormString(formData, "counterAmount"),
    });
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath(`/shipments/${shipmentId}`);
  revalidatePath("/shipments");
  return undefined;
}

export async function advanceShipmentStatusAction(
  shipmentId: string,
  targetStatus: ShipmentStatus
): Promise<ShipmentFormState> {
  try {
    const ctx = await requireTenantContext();
    await advanceShipmentStatus(ctx, { shipmentId, targetStatus });
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath(`/shipments/${shipmentId}`);
  revalidatePath("/shipments");
  revalidatePath("/vehicles");
  revalidatePath("/drivers");
  revalidatePath("/dashboard");
  return undefined;
}

export async function cancelShipmentAction(
  shipmentId: string
): Promise<ShipmentFormState> {
  try {
    const ctx = await requireTenantContext();
    await cancelShipment(ctx, shipmentId);
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath(`/shipments/${shipmentId}`);
  revalidatePath("/shipments");
  revalidatePath("/vehicles");
  revalidatePath("/drivers");
  revalidatePath("/dashboard");
  return undefined;
}

export async function resolveShipmentIncidentAsDispatcherAction(
  shipmentId: string,
  _prevState: ShipmentFormState,
  formData: FormData
): Promise<ShipmentFormState> {
  try {
    const ctx = await requireTenantContext();
    await resolveShipmentIncidentAsDispatcher(ctx, {
      shipmentId,
      resolutionNote: optionalFormString(formData, "resolutionNote"),
    });
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath(`/shipments/${shipmentId}`);
  revalidatePath("/shipments");
  revalidatePath("/driver");
  return undefined;
}
