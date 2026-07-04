import { prisma } from "@/lib/db";
import {
  CompanyType,
  StatusChangeSource,
  StatusEntityType,
  VehicleStatus,
} from "@/generated/prisma/client";
import { recordStatusChange } from "@/core/shared/status-history";
import { NotFoundError, ValidationError } from "@/core/shared/errors";
import { requireCompanyType } from "@/core/shared/authorization";
import type { TenantContext } from "@/core/shared/tenant-context";

/**
 * Maintenance is a side-state independent of the shipment flow: it can only
 * be entered from AVAILABLE (never while a vehicle is on an active shipment)
 * and only ever exits back to AVAILABLE.
 */
export async function setVehicleMaintenance(
  ctx: TenantContext,
  vehicleId: string,
  inMaintenance: boolean
) {
  requireCompanyType(ctx, CompanyType.SUPPLIER);

  return prisma.$transaction(async (tx) => {
    const vehicle = await tx.vehicle.findFirst({
      where: { id: vehicleId, companyId: ctx.companyId },
    });
    if (!vehicle) throw new NotFoundError("Araç bulunamadı.");

    if (inMaintenance && vehicle.status !== VehicleStatus.AVAILABLE) {
      throw new ValidationError(
        "Yalnızca müsait durumdaki bir araç bakıma alınabilir. Aktif seferdeki bir aracı bakıma almadan önce seferini tamamlayın veya iptal edin."
      );
    }
    if (!inMaintenance && vehicle.status !== VehicleStatus.MAINTENANCE) {
      throw new ValidationError("Bu araç bakımda değil.");
    }

    const targetStatus = inMaintenance
      ? VehicleStatus.MAINTENANCE
      : VehicleStatus.AVAILABLE;

    const updated = await tx.vehicle.update({
      where: { id: vehicle.id },
      data: { status: targetStatus },
    });
    await recordStatusChange(tx, {
      entityType: StatusEntityType.VEHICLE,
      entityId: vehicle.id,
      fromStatus: vehicle.status,
      toStatus: targetStatus,
      changedByUserId: ctx.userId,
      source: StatusChangeSource.MANUAL,
    });

    return updated;
  });
}
