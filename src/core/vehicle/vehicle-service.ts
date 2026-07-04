import { prisma } from "@/lib/db";
import { requireCompanyType } from "@/core/shared/authorization";
import type { TenantContext } from "@/core/shared/tenant-context";
import { NotFoundError, ValidationError } from "@/core/shared/errors";
import * as vehicleRepository from "@/core/vehicle/vehicle-repository";
import { vehicleInputSchema } from "@/lib/validation/vehicle";
import { CompanyType, VehicleStatus } from "@/generated/prisma/client";

export async function listVehicles(
  ctx: TenantContext,
  filter?: { status?: VehicleStatus }
) {
  requireCompanyType(ctx, CompanyType.SUPPLIER);
  return vehicleRepository.listVehiclesForTenant(ctx, filter);
}

export async function getVehicle(ctx: TenantContext, vehicleId: string) {
  requireCompanyType(ctx, CompanyType.SUPPLIER);
  const vehicle = await vehicleRepository.getVehicleForTenant(ctx, vehicleId);
  if (!vehicle) throw new NotFoundError("Araç bulunamadı.");
  return vehicle;
}

export async function createVehicle(ctx: TenantContext, rawInput: unknown) {
  requireCompanyType(ctx, CompanyType.SUPPLIER);
  const input = vehicleInputSchema.parse(rawInput);

  const existing = await vehicleRepository.findVehicleByPlate(input.plate);
  if (existing) {
    throw new ValidationError(
      `${input.plate} plakalı araç zaten sistemde kayıtlı.`
    );
  }

  return vehicleRepository.createVehicleRecord(ctx, input);
}

export async function updateVehicle(
  ctx: TenantContext,
  vehicleId: string,
  rawInput: unknown
) {
  requireCompanyType(ctx, CompanyType.SUPPLIER);
  const input = vehicleInputSchema.parse(rawInput);

  const existing = await vehicleRepository.getVehicleForTenant(ctx, vehicleId);
  if (!existing) throw new NotFoundError("Araç bulunamadı.");

  if (input.plate !== existing.plate) {
    const plateOwner = await vehicleRepository.findVehicleByPlate(input.plate);
    if (plateOwner) {
      throw new ValidationError(
        `${input.plate} plakalı araç zaten sistemde kayıtlı.`
      );
    }
  }

  await vehicleRepository.updateVehicleRecord(ctx, vehicleId, input);
}

export async function deleteVehicle(ctx: TenantContext, vehicleId: string) {
  requireCompanyType(ctx, CompanyType.SUPPLIER);

  const existing = await vehicleRepository.getVehicleForTenant(ctx, vehicleId);
  if (!existing) throw new NotFoundError("Araç bulunamadı.");

  if (existing.status !== VehicleStatus.AVAILABLE) {
    throw new ValidationError(
      "Yalnızca müsait durumdaki araçlar silinebilir. Aktif seferdeki bir aracı silmeden önce seferi tamamlayın veya iptal edin."
    );
  }

  try {
    await vehicleRepository.deleteVehicleRecord(ctx, vehicleId);
  } catch {
    throw new ValidationError(
      "Bu aracın sefer geçmişi bulunduğu için silinemiyor."
    );
  }
}

export async function getFleetStatusCounts(ctx: TenantContext) {
  requireCompanyType(ctx, CompanyType.SUPPLIER);
  const groups = await vehicleRepository.countVehiclesByStatus(ctx);
  return groups.reduce(
    (acc, g) => {
      acc[g.status] = g._count;
      return acc;
    },
    {} as Record<VehicleStatus, number>
  );
}

export async function getFleetOccupancyByType(ctx: TenantContext) {
  requireCompanyType(ctx, CompanyType.SUPPLIER);
  return vehicleRepository.countVehiclesByTypeAndStatus(ctx);
}

// Used by shipment-service to validate/lock a vehicle inside a transaction.
export async function assertVehicleAvailableForAssignment(
  tx: typeof prisma,
  ctx: TenantContext,
  vehicleId: string
) {
  const vehicle = await tx.vehicle.findFirst({
    where: { id: vehicleId, companyId: ctx.companyId },
  });
  if (!vehicle) throw new NotFoundError("Araç bulunamadı.");
  if (vehicle.status !== VehicleStatus.AVAILABLE) {
    throw new ValidationError("Seçilen araç şu anda müsait değil.");
  }
  return vehicle;
}
