import { requireCompanyType } from "@/core/shared/authorization";
import type { TenantContext } from "@/core/shared/tenant-context";
import { InvalidTransitionError, NotFoundError } from "@/core/shared/errors";
import * as dockReservationRepository from "@/core/warehouse/dock-reservation-repository";
import { advanceShipmentStatus } from "@/core/shipment/shipment-status";
import {
  CompanyType,
  DockReservationStatus,
  ShipmentStatus,
  StatusChangeSource,
} from "@/generated/prisma/client";

async function transition(
  ctx: TenantContext,
  reservationId: string,
  fromStatuses: DockReservationStatus[],
  toStatus: DockReservationStatus,
  timestampField: "arrivedAt" | "completedAt" | "cancelledAt"
) {
  requireCompanyType(ctx, CompanyType.SUPPLIER);
  const result = await dockReservationRepository.transitionReservationStatus(
    ctx,
    reservationId,
    fromStatuses,
    toStatus,
    timestampField
  );
  if (result.kind === "not_found") throw new NotFoundError("Rezervasyon bulunamadı.");
  if (result.kind === "invalid_transition") {
    throw new InvalidTransitionError(
      "Bu rezervasyon artık bu duruma geçemez."
    );
  }
  return result.reservation;
}

/**
 * Best-effort: advances the reservation's linked shipment (if any) toward
 * the status that corresponds to this dock event. A dispatcher opted into
 * this link explicitly (see dock-reservation-service.ts's createReservation
 * validation), but the shipment might not actually be at the matching step
 * yet — e.g. still ASSIGNED, not yet HEADING_TO_PICKUP — in which case the
 * DAG in shipment-transitions.ts rejects the jump. This never throws and
 * never blocks the reservation's own status change, which has already
 * committed by the time this runs; it just silently does nothing rather
 * than forcing the shipment's state machine into an inconsistent jump.
 */
async function syncShipmentStatus(
  ctx: TenantContext,
  shipmentId: string | null,
  targetStatus: ShipmentStatus,
  reservationId: string
) {
  if (!shipmentId) return;
  try {
    await advanceShipmentStatus(
      ctx,
      { shipmentId, targetStatus },
      StatusChangeSource.SYSTEM_AUTO,
      reservationId
    );
  } catch {
    // Invalid transition right now, or some other failure — the
    // reservation's own status change already succeeded, so this is
    // swallowed rather than surfaced as an error on that action.
  }
}

export async function markVehicleArrived(ctx: TenantContext, reservationId: string) {
  const reservation = await transition(
    ctx,
    reservationId,
    [DockReservationStatus.CREATED],
    DockReservationStatus.VEHICLE_ARRIVED,
    "arrivedAt"
  );
  await syncShipmentStatus(
    ctx,
    reservation.shipmentId,
    ShipmentStatus.LOADING,
    reservationId
  );
  return reservation;
}

/** Reachable from CREATED directly too — dispatchers don't always log the "vehicle arrived" step separately. */
export async function markCompleted(ctx: TenantContext, reservationId: string) {
  const reservation = await transition(
    ctx,
    reservationId,
    [DockReservationStatus.CREATED, DockReservationStatus.VEHICLE_ARRIVED],
    DockReservationStatus.COMPLETED,
    "completedAt"
  );
  // Best-effort chain: if this reservation skipped VEHICLE_ARRIVED (came
  // straight from CREATED), the linked shipment may still need the LOADING
  // step before AT_PICKUP_GATE is a valid transition — attempt both in
  // sequence, each independently best-effort.
  await syncShipmentStatus(
    ctx,
    reservation.shipmentId,
    ShipmentStatus.LOADING,
    reservationId
  );
  await syncShipmentStatus(
    ctx,
    reservation.shipmentId,
    ShipmentStatus.AT_PICKUP_GATE,
    reservationId
  );
  return reservation;
}

/** Deliberately no shipment sync: cancelling a dock slot doesn't mean the shipment itself is cancelled — the dispatcher handles that separately (cancelShipment) if it actually applies. */
export function cancelReservation(ctx: TenantContext, reservationId: string) {
  return transition(
    ctx,
    reservationId,
    [DockReservationStatus.CREATED, DockReservationStatus.VEHICLE_ARRIVED],
    DockReservationStatus.CANCELLED,
    "cancelledAt"
  );
}
