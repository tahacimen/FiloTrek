import { prisma } from "@/lib/db";
import type { GateGuardContext } from "@/core/shared/gate-guard-context";
import {
  DockReservationStatus,
  GateEventType,
  ShipmentStatus,
} from "@/generated/prisma/client";

const shipmentWithLatestGateEventInclude = {
  vehicle: { select: { id: true, plate: true } },
  driver: { select: { id: true, fullName: true } },
  // Most recent event only — a shipment's current in/out status is
  // whatever its last logged event says (see the GateEvent model comment).
  gateEvents: {
    orderBy: { occurredAt: "desc" as const },
    take: 1,
  },
  // At most one active reservation can ever be linked (partial unique
  // index, see add_dock_reservation_shipment_unique) — surfaced here so the
  // gate guard can advance its status (Araç Geldi/Tamamlandı) right from
  // this same screen, alongside their own gate entry/exit log.
  dockReservations: {
    where: { status: { not: DockReservationStatus.CANCELLED } },
    include: { dock: { select: { name: true, warehouse: { select: { name: true } } } } },
    take: 1,
  },
} as const;

/** A gate guard only ever sees active shipments belonging to their own (CUSTOMER) company, with a vehicle already assigned. */
export function listActiveShipmentsForGateGuard(companyId: string) {
  return prisma.shipment.findMany({
    where: {
      customerCompanyId: companyId,
      vehicleId: { not: null },
      status: { notIn: [ShipmentStatus.COMPLETED, ShipmentStatus.CANCELLED] },
    },
    include: shipmentWithLatestGateEventInclude,
    orderBy: { createdAt: "desc" },
  });
}

/** Scoped to the gate guard's own company via the shipment's customerCompanyId — the same ownership check pattern as driver-repository's shipment scoping. */
export function getShipmentForGateGuard(companyId: string, shipmentId: string) {
  return prisma.shipment.findFirst({
    where: { id: shipmentId, customerCompanyId: companyId },
    include: shipmentWithLatestGateEventInclude,
  });
}

export function createGateEvent(
  gateGuardCtx: GateGuardContext,
  shipmentId: string,
  eventType: GateEventType
) {
  return prisma.gateEvent.create({
    data: {
      shipmentId,
      gateGuardId: gateGuardCtx.gateGuardId,
      eventType,
    },
  });
}
