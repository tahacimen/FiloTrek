import * as scorecardRepository from "@/core/scorecard/scorecard-repository";
import * as ratingRepository from "@/core/rating/rating-repository";
import { ShipmentStatus } from "@/generated/prisma/client";

export type SupplierScorecard = {
  averageRating: number | null;
  ratingCount: number;
  onTimePickupRate: number | null;
  cancellationRate: number | null;
  completedShipmentCount: number;
};

/**
 * Aggregate supplier performance shown to customers (on the open-marketplace
 * bid list, so they can compare bidders beyond just price) and to the
 * supplier itself (own dashboard). Deliberately takes a bare companyId, not
 * a TenantContext — this summary is meant to be visible across tenants
 * (same as a company's name), not owner-scoped like most of this codebase.
 */
export async function getSupplierScorecard(
  supplierCompanyId: string
): Promise<SupplierScorecard> {
  const [statusCounts, onTimeStats, ratingStats] = await Promise.all([
    scorecardRepository.getShipmentCounts(supplierCompanyId),
    scorecardRepository.getOnTimePickupStats(supplierCompanyId),
    ratingRepository.getSupplierRatingStats(supplierCompanyId),
  ]);

  const totalShipments = statusCounts.reduce((sum, row) => sum + row._count, 0);
  const cancelledShipments =
    statusCounts.find((row) => row.status === ShipmentStatus.CANCELLED)?._count ?? 0;
  const completedShipmentCount =
    statusCounts.find((row) => row.status === ShipmentStatus.COMPLETED)?._count ?? 0;

  return {
    averageRating: ratingStats._avg.score,
    ratingCount: ratingStats._count,
    onTimePickupRate:
      onTimeStats.eligible === 0 ? null : onTimeStats.onTime / onTimeStats.eligible,
    cancellationRate: totalShipments === 0 ? null : cancelledShipments / totalShipments,
    completedShipmentCount,
  };
}
