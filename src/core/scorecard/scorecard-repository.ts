import { prisma } from "@/lib/db";
import { ShipmentStatus, StatusEntityType } from "@/generated/prisma/client";

export function getShipmentCounts(supplierCompanyId: string) {
  return prisma.shipment.groupBy({
    by: ["status"],
    where: { supplierCompanyId },
    _count: true,
  });
}

/**
 * On-time pickup: among shipments with an ETA set (estimatedPickupArrivalAt)
 * that actually reached LOADING, how many did so at or before that ETA.
 * StatusHistory is keyed by a generic (entityType, entityId) pair rather
 * than a direct FK, so this joins the two in application code rather than a
 * single query — shipments only ever move forward through LOADING once, so
 * there's at most one matching history row per shipment.
 */
export async function getOnTimePickupStats(supplierCompanyId: string) {
  const shipments = await prisma.shipment.findMany({
    where: { supplierCompanyId, estimatedPickupArrivalAt: { not: null } },
    select: { id: true, estimatedPickupArrivalAt: true },
  });
  if (shipments.length === 0) return { eligible: 0, onTime: 0 };

  const histories = await prisma.statusHistory.findMany({
    where: {
      entityType: StatusEntityType.SHIPMENT,
      entityId: { in: shipments.map((s) => s.id) },
      toStatus: ShipmentStatus.LOADING,
    },
    select: { entityId: true, createdAt: true },
  });
  const arrivedAtByShipmentId = new Map(
    histories.map((h) => [h.entityId, h.createdAt])
  );

  let eligible = 0;
  let onTime = 0;
  for (const shipment of shipments) {
    const arrivedAt = arrivedAtByShipmentId.get(shipment.id);
    if (!arrivedAt) continue;
    eligible += 1;
    if (arrivedAt <= shipment.estimatedPickupArrivalAt!) onTime += 1;
  }
  return { eligible, onTime };
}
