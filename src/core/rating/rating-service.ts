import { requireCompanyType } from "@/core/shared/authorization";
import type { TenantContext } from "@/core/shared/tenant-context";
import { NotFoundError, ValidationError } from "@/core/shared/errors";
import * as ratingRepository from "@/core/rating/rating-repository";
import { ratingInputSchema } from "@/lib/validation/rating";
import { CompanyType, ShipmentStatus } from "@/generated/prisma/client";

/**
 * One-directional: only the customer rates the supplier/driver, never the
 * reverse — a deliberate product decision, not a placeholder for a future
 * two-way system. Exactly one rating per shipment, only once COMPLETED.
 */
export async function rateShipment(
  ctx: TenantContext,
  shipmentId: string,
  rawInput: unknown
) {
  requireCompanyType(ctx, CompanyType.CUSTOMER);
  const input = ratingInputSchema.parse(rawInput);

  const shipment = await ratingRepository.getShipmentForRating(
    shipmentId,
    ctx.companyId
  );
  if (!shipment) {
    throw new NotFoundError("Sefer bulunamadı.");
  }
  if (shipment.status !== ShipmentStatus.COMPLETED) {
    throw new ValidationError(
      "Yalnızca tamamlanmış seferler değerlendirilebilir."
    );
  }
  // supplierCompanyId is always set by the time a shipment reaches
  // COMPLETED (assignVehicleAndDriver sets it before any status advance
  // past PENDING is possible), so this is a defensive guard, not a real
  // runtime path.
  if (!shipment.supplierCompanyId) {
    throw new ValidationError("Sefere atanmış bir tedarikçi bulunamıyor.");
  }

  const existing = await ratingRepository.getRatingForShipment(shipmentId);
  if (existing) {
    throw new ValidationError("Bu sefer zaten değerlendirildi.");
  }

  return ratingRepository.createRating({
    shipmentId,
    customerCompanyId: ctx.companyId,
    supplierCompanyId: shipment.supplierCompanyId,
    driverId: shipment.driverId,
    score: input.score,
    comment: input.comment,
  });
}

export async function getRatingForShipment(shipmentId: string) {
  return ratingRepository.getRatingForShipment(shipmentId);
}
