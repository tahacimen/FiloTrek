import { prisma } from "@/lib/db";
import { ShipmentStatus } from "@/generated/prisma/client";

const openShipmentListInclude = {
  customerCompany: { select: { id: true, name: true } },
};

/**
 * Every supplier sees the same open pool — this is a real marketplace, not
 * scoped to a single tenant. `myBid` narrows to the calling supplier's own
 * (if any) so the UI can show "teklifiniz: X ₺" instead of a bare list.
 */
// `isDemo` keeps the pool realm-scoped: a demo supplier only ever sees demo
// customers' open shipments, and real suppliers never see the sandbox (and
// vice versa). Matched on the owning customer company's realm.
export function listOpenShipmentsForBidding(
  supplierCompanyId: string,
  isDemo: boolean
) {
  return prisma.shipment.findMany({
    where: {
      supplierCompanyId: null,
      status: ShipmentStatus.PENDING,
      customerCompany: { isDemo },
    },
    include: {
      ...openShipmentListInclude,
      bids: { where: { supplierCompanyId }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });
}

export function getOpenShipmentById(shipmentId: string, isDemo: boolean) {
  return prisma.shipment.findFirst({
    where: {
      id: shipmentId,
      supplierCompanyId: null,
      status: ShipmentStatus.PENDING,
      customerCompany: { isDemo },
    },
  });
}

/** One active bid per supplier per shipment — resubmitting overwrites price/message on the same row. */
export function upsertBid(
  shipmentId: string,
  supplierCompanyId: string,
  data: { price: number; message?: string }
) {
  return prisma.shipmentBid.upsert({
    where: { shipmentId_supplierCompanyId: { shipmentId, supplierCompanyId } },
    create: { shipmentId, supplierCompanyId, ...data },
    update: data,
  });
}

/** Scoped to a shipment the caller has already confirmed they own (see marketplace-service.ts). */
export function listBidsForShipment(shipmentId: string) {
  return prisma.shipmentBid.findMany({
    where: { shipmentId },
    include: { supplierCompany: { select: { id: true, name: true } } },
    orderBy: { price: "asc" },
  });
}
