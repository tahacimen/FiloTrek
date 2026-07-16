import { requireCompanyType } from "@/core/shared/authorization";
import type { TenantContext } from "@/core/shared/tenant-context";
import { InvalidTransitionError, NotFoundError } from "@/core/shared/errors";
import * as dockReservationRepository from "@/core/warehouse/dock-reservation-repository";
import { CompanyType, DockReservationStatus } from "@/generated/prisma/client";

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

export function markVehicleArrived(ctx: TenantContext, reservationId: string) {
  return transition(
    ctx,
    reservationId,
    [DockReservationStatus.CREATED],
    DockReservationStatus.VEHICLE_ARRIVED,
    "arrivedAt"
  );
}

/** Reachable from CREATED directly too — dispatchers don't always log the "vehicle arrived" step separately. */
export function markCompleted(ctx: TenantContext, reservationId: string) {
  return transition(
    ctx,
    reservationId,
    [DockReservationStatus.CREATED, DockReservationStatus.VEHICLE_ARRIVED],
    DockReservationStatus.COMPLETED,
    "completedAt"
  );
}

export function cancelReservation(ctx: TenantContext, reservationId: string) {
  return transition(
    ctx,
    reservationId,
    [DockReservationStatus.CREATED, DockReservationStatus.VEHICLE_ARRIVED],
    DockReservationStatus.CANCELLED,
    "cancelledAt"
  );
}
