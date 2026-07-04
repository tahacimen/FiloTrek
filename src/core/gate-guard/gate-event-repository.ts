import { prisma } from "@/lib/db";
import type { GateGuardContext } from "@/core/shared/gate-guard-context";
import { GateEventType, ShipmentStatus } from "@/generated/prisma/client";

const shipmentWithLatestGateEventInclude = {
  vehicle: { select: { id: true, plate: true } },
  driver: { select: { id: true, fullName: true } },
  // Most recent event only — a shipment's current in/out status is
  // whatever its last logged event says (see the GateEvent model comment).
  gateEvents: {
    orderBy: { occurredAt: "desc" as const },
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
