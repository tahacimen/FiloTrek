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

/** Every reservation across ALL of the tenant's warehouses/docks whose slot starts within [rangeStart, rangeEnd) — the reporting page's data source. */
export function listReservationsForCompanyInRange(
  ctx: TenantContext,
  rangeStart: Date,
  rangeEnd: Date
) {
  return prisma.dockReservation.findMany({
    where: {
      dock: { warehouse: { companyId: ctx.companyId } },
      startAt: { gte: rangeStart, lt: rangeEnd },
    },
    select: {
      id: true,
      dockId: true,
      reservationType: true,
      status: true,
      startAt: true,
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

/**
 * The one active (non-cancelled) reservation linked to a shipment, if any —
 * at most one can exist, enforced by a partial unique index (see the
 * add_dock_reservation_shipment_unique migration). Used both to reject a
 * second link attempt in createReservation and to show the link on the
 * shipment detail page.
 */
export function findActiveReservationForShipment(
  ctx: TenantContext,
  shipmentId: string
) {
  return prisma.dockReservation.findFirst({
    where: {
      shipmentId,
      status: { not: DockReservationStatus.CANCELLED },
      dock: { warehouse: { companyId: ctx.companyId } },
    },
    include: {
      dock: {
        select: { id: true, name: true, warehouse: { select: { id: true, name: true } } },
      },
    },
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
