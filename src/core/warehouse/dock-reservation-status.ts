import type { TenantContext } from "@/core/shared/tenant-context";
import type { GateGuardContext } from "@/core/shared/gate-guard-context";
import { requireCompanyType } from "@/core/shared/authorization";
import { InvalidTransitionError, NotFoundError } from "@/core/shared/errors";
import * as dockReservationRepository from "@/core/warehouse/dock-reservation-repository";
import { advanceShipmentStatusAsGateGuard } from "@/core/shipment/shipment-status";
import {
  CompanyType,
  DockReservationStatus,
  ShipmentStatus,
} from "@/generated/prisma/client";

async function transition(
  ctx: { companyId: string },
  reservationId: string,
  fromStatuses: DockReservationStatus[],
  toStatus: DockReservationStatus,
  timestampField: "arrivedAt" | "completedAt" | "cancelledAt"
) {
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
 * the status that corresponds to this dock event. The customer opted into
 * this link explicitly when creating the reservation from the shipment's
 * own detail page (see dock-reservation-service.ts's createReservation
 * validation), but the shipment might not actually be at the matching step
 * yet — e.g. still ASSIGNED, not yet HEADING_TO_PICKUP — in which case the
 * DAG in shipment-transitions.ts rejects the jump. This never throws and
 * never blocks the reservation's own status change, which has already
 * committed by the time this runs; it just silently does nothing rather
 * than forcing the shipment's state machine into an inconsistent jump.
 */
async function syncShipmentStatus(
  gateGuardCtx: GateGuardContext,
  shipmentId: string | null,
  targetStatus: ShipmentStatus,
  reservationId: string
) {
  if (!shipmentId) return;
  try {
    await advanceShipmentStatusAsGateGuard(gateGuardCtx, {
      shipmentId,
      targetStatus,
      reservationId,
    });
  } catch {
    // Invalid transition right now, or some other failure — the
    // reservation's own status change already succeeded, so this is
    // swallowed rather than surfaced as an error on that action.
  }
}

export async function markVehicleArrived(
  gateGuardCtx: GateGuardContext,
  reservationId: string
) {
  const reservation = await transition(
    gateGuardCtx,
    reservationId,
    [DockReservationStatus.CREATED],
    DockReservationStatus.VEHICLE_ARRIVED,
    "arrivedAt"
  );
  await syncShipmentStatus(
    gateGuardCtx,
    reservation.shipmentId,
    ShipmentStatus.LOADING,
    reservationId
  );
  return reservation;
}

/** Reachable from CREATED directly too — the gate guard doesn't always log the "vehicle arrived" step separately. */
export async function markCompleted(
  gateGuardCtx: GateGuardContext,
  reservationId: string
) {
  const reservation = await transition(
    gateGuardCtx,
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
    gateGuardCtx,
    reservation.shipmentId,
    ShipmentStatus.LOADING,
    reservationId
  );
  await syncShipmentStatus(
    gateGuardCtx,
    reservation.shipmentId,
    ShipmentStatus.AT_PICKUP_GATE,
    reservationId
  );
  return reservation;
}

/**
 * Cancelling is an administrative scheduling decision, not a physical gate
 * event — the customer's own dashboard user does this (TenantContext),
 * unlike markVehicleArrived/markCompleted above (GateGuardContext).
 * Deliberately no shipment sync: cancelling a dock slot doesn't mean the
 * shipment itself is cancelled.
 */
export function cancelReservation(ctx: TenantContext, reservationId: string) {
  requireCompanyType(ctx, CompanyType.CUSTOMER);
  return transition(
    ctx,
    reservationId,
    [DockReservationStatus.CREATED, DockReservationStatus.VEHICLE_ARRIVED],
    DockReservationStatus.CANCELLED,
    "cancelledAt"
  );
}
