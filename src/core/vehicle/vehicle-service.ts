import { prisma } from "@/lib/db";
import { requireCompanyType } from "@/core/shared/authorization";
import type { TenantContext } from "@/core/shared/tenant-context";
import { NotFoundError, ValidationError } from "@/core/shared/errors";
import * as vehicleRepository from "@/core/vehicle/vehicle-repository";
import { vehicleInputSchema } from "@/lib/validation/vehicle";
import { saveUploadedPhoto } from "@/lib/file-storage";
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

export async function createVehicle(
  ctx: TenantContext,
  rawInput: unknown,
  registrationPhoto?: File
) {
  requireCompanyType(ctx, CompanyType.SUPPLIER);
  const input = vehicleInputSchema.parse(rawInput);

  // A2: the ruhsat photo is mandatory when adding a new vehicle. Checked for
  // presence here (before any DB write); its format/size are validated by
  // saveUploadedPhoto below.
  const hasPhoto =
    registrationPhoto instanceof File && registrationPhoto.size > 0;
  if (!hasPhoto) {
    throw new ValidationError("Ruhsat fotoğrafı yüklemek zorunludur.");
  }

  const existing = await vehicleRepository.findVehicleByPlate(input.plate);
  if (existing) {
    throw new ValidationError(
      `${input.plate} plakalı araç zaten sistemde kayıtlı.`
    );
  }

  const vehicle = await vehicleRepository.createVehicleRecord(ctx, input);
  try {
    const photoUrl = await saveUploadedPhoto(registrationPhoto!, vehicle.id);
    await vehicleRepository.setVehicleRegistrationPhoto(ctx, vehicle.id, photoUrl);
    return { ...vehicle, registrationPhotoUrl: photoUrl };
  } catch (error) {
    // Don't leave a vehicle without its mandatory photo — roll back the row.
    await vehicleRepository.deleteVehicleRecord(ctx, vehicle.id).catch(() => {});
    throw error;
  }
}

export async function updateVehicle(
  ctx: TenantContext,
  vehicleId: string,
  rawInput: unknown,
  registrationPhoto?: File
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

  // A2: on edit the photo is optional — only replace it when a new one is
  // actually attached, keeping the existing one otherwise.
  if (registrationPhoto instanceof File && registrationPhoto.size > 0) {
    const photoUrl = await saveUploadedPhoto(registrationPhoto, vehicleId);
    await vehicleRepository.setVehicleRegistrationPhoto(ctx, vehicleId, photoUrl);
  }
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
