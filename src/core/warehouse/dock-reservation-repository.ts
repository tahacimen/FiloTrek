import { prisma } from "@/lib/db";
import type { TenantContext } from "@/core/shared/tenant-context";
import type { ReservationInput } from "@/lib/validation/warehouse";
import { DockReservationStatus } from "@/generated/prisma/client";

/** Tenant-scoped through dock -> warehouse -> company, same relation-filter pattern as getDockForTenant. */
function tenantDockFilter(ctx: TenantContext, dockId: string) {
  return { dockId, dock: { warehouse: { companyId: ctx.companyId } } };
}

/**
 * Every reservation whose slot STARTS within [weekStart, weekEnd) — the
 * natural definition for "what's on this week's calendar." Slots never
 * span a week boundary (they're bounded by a single day's working hours),
 * so this can't miss a reservation that's visually on this week's grid.
 */
export function listReservationsForDock(
  ctx: TenantContext,
  dockId: string,
  weekStart: Date,
  weekEnd: Date
) {
  return prisma.dockReservation.findMany({
    where: {
      ...tenantDockFilter(ctx, dockId),
      startAt: { gte: weekStart, lt: weekEnd },
    },
    orderBy: { startAt: "asc" },
  });
}

export function getReservationForTenant(
  ctx: TenantContext,
  reservationId: string
) {
  return prisma.dockReservation.findFirst({
    where: { id: reservationId, dock: { warehouse: { companyId: ctx.companyId } } },
  });
}

export function createReservationRecord(
  dockId: string,
  endAt: Date,
  data: ReservationInput
) {
  const { shipmentId, ...rest } = data;
  return prisma.dockReservation.create({
    data: {
      ...rest,
      dockId,
      endAt,
      shipmentId: shipmentId ?? null,
    },
  });
}

/** Atomic guard: only transitions out of `fromStatuses`, mirrors setVehicleMaintenance's findFirst+update-in-transaction shape. */
export async function transitionReservationStatus(
  ctx: TenantContext,
  reservationId: string,
  fromStatuses: DockReservationStatus[],
  toStatus: DockReservationStatus,
  timestampField: "arrivedAt" | "completedAt" | "cancelledAt"
) {
  return prisma.$transaction(async (tx) => {
    const reservation = await tx.dockReservation.findFirst({
      where: {
        id: reservationId,
        dock: { warehouse: { companyId: ctx.companyId } },
      },
    });
    if (!reservation) return { kind: "not_found" as const };
    if (!fromStatuses.includes(reservation.status)) {
      return { kind: "invalid_transition" as const, current: reservation.status };
    }
    const updated = await tx.dockReservation.update({
      where: { id: reservationId },
      data: { status: toStatus, [timestampField]: new Date() },
    });
    return { kind: "ok" as const, reservation: updated };
  });
}
