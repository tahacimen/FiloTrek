"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireTenantContext } from "@/core/shared/tenant-context";
import * as shipmentService from "@/core/shipment/shipment-service";
import * as ratingService from "@/core/rating/rating-service";
import * as dockReservationService from "@/core/warehouse/dock-reservation-service";
import {
  advanceShipmentStatus,
  cancelShipment,
} from "@/core/shipment/shipment-status";
import { resolveShipmentIncidentAsDispatcher } from "@/core/shipment/shipment-incident";
import { computeRoadDistanceKm } from "@/lib/geo-distance";
import { toActionErrorMessage } from "@/lib/action-error";
import type { ShipmentStatus } from "@/generated/prisma/client";

export type ShipmentFormState = { error?: string } | undefined;

/**
 * C2: estimate the road distance (km) between the chosen loading and delivery
 * points for the "Araç Çağır" form. Customer-only (it's their request flow).
 * Returns null km when it couldn't be computed, so the client falls back to a
 * manual entry rather than blocking the request.
 */
export async function estimateDistanceKmAction(
  originQuery: string,
  destinationQuery: string
): Promise<{ km: number | null }> {
  try {
    await requireTenantContext();
    if (!originQuery?.trim() || !destinationQuery?.trim()) {
      return { km: null };
    }
    const km = await computeRoadDistanceKm(originQuery, destinationQuery);
    return { km };
  } catch {
    return { km: null };
  }
}

/** Empty optional inputs arrive as "" in FormData, not absent — normalize to undefined. */
function optionalFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** Shared by both creation actions — see the DangerousGoodsFields component for the hidden-input encoding. */
function dangerousGoodsFieldsFromForm(formData: FormData) {
  return {
    isDangerousGoods: formData.get("isDangerousGoods") === "true",
    adrClass: optionalFormString(formData, "adrClass"),
    requiresColdChain: formData.get("requiresColdChain") === "true",
    temperatureMinC: optionalFormString(formData, "temperatureMinC"),
    temperatureMaxC: optionalFormString(formData, "temperatureMaxC"),
  };
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
      ...dangerousGoodsFieldsFromForm(formData),
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
      supplierCompanyId: optionalFormString(formData, "supplierCompanyId"),
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
      destinationProvince: optionalFormString(formData, "destinationProvince"),
      destinationDistrict: optionalFormString(formData, "destinationDistrict"),
      latestLoadingAt: optionalFormString(formData, "latestLoadingAt"),
      ...dangerousGoodsFieldsFromForm(formData),
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

export type LiveLinkResult = { url: string } | { error: string };

/** N5: mint-or-reuse the shipment's live-tracking token and return its public URL. */
export async function getLiveTrackingLinkAction(
  shipmentId: string
): Promise<LiveLinkResult> {
  try {
    const ctx = await requireTenantContext();
    const token = await shipmentService.ensureTrackingToken(ctx, shipmentId);
    const { getRequestOrigin } = await import("@/lib/request-origin");
    const origin = await getRequestOrigin();
    return { url: `${origin}/canli/${token}` };
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
}

/** N4: set or clear the "en geç yükleme saati" (either party). */
export async function setLatestLoadingAction(
  shipmentId: string,
  _prevState: ShipmentFormState,
  formData: FormData
): Promise<ShipmentFormState> {
  try {
    const ctx = await requireTenantContext();
    await shipmentService.setLatestLoading(ctx, shipmentId, {
      latestLoadingAt: formData.get("latestLoadingAt"),
    });
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath(`/shipments/${shipmentId}`);
  revalidatePath("/shipments");
  return undefined;
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

/**
 * The "sefer üzerinden" reservation flow: unlike the general dock calendar's
 * click-a-cell form, plate/driver/vehicleType are never collected here —
 * they come straight from this shipment's own already-assigned vehicle and
 * driver (see dock-reservation-dialog.tsx), so the payload only carries
 * what the customer actually chooses (dock, date, time, reason).
 */
export async function createDockReservationForShipmentAction(
  shipmentId: string,
  dockId: string,
  _prevState: ShipmentFormState,
  formData: FormData
): Promise<ShipmentFormState> {
  try {
    const ctx = await requireTenantContext();
    const raw = formData.get("payload");
    const payload = typeof raw === "string" ? JSON.parse(raw) : {};
    await dockReservationService.createReservation(ctx, dockId, {
      ...payload,
      shipmentId,
    });
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath(`/shipments/${shipmentId}`);
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

export async function rateShipmentAction(
  shipmentId: string,
  _prevState: ShipmentFormState,
  formData: FormData
): Promise<ShipmentFormState> {
  try {
    const ctx = await requireTenantContext();
    await ratingService.rateShipment(ctx, shipmentId, {
      score: formData.get("score"),
      comment: optionalFormString(formData, "comment"),
    });
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath(`/shipments/${shipmentId}`);
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
