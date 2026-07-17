import { prisma } from "@/lib/db";

export function getShipmentForRating(shipmentId: string, customerCompanyId: string) {
  return prisma.shipment.findFirst({
    where: { id: shipmentId, customerCompanyId },
    select: {
      id: true,
      status: true,
      supplierCompanyId: true,
      driverId: true,
    },
  });
}

export function getRatingForShipment(shipmentId: string) {
  return prisma.rating.findUnique({ where: { shipmentId } });
}

export function createRating(data: {
  shipmentId: string;
  customerCompanyId: string;
  supplierCompanyId: string;
  driverId: string | null;
  score: number;
  comment?: string;
}) {
  return prisma.rating.create({ data });
}

export function getSupplierRatingStats(supplierCompanyId: string) {
  return prisma.rating.aggregate({
    where: { supplierCompanyId },
    _avg: { score: true },
    _count: true,
  });
}
