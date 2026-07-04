import { prisma } from "@/lib/db";
import type { TenantContext } from "@/core/shared/tenant-context";
import type { VehicleInput } from "@/lib/validation/vehicle";
import { VehicleStatus } from "@/generated/prisma/client";

export function listVehiclesForTenant(
  ctx: TenantContext,
  filter?: { status?: VehicleStatus }
) {
  return prisma.vehicle.findMany({
    where: {
      companyId: ctx.companyId,
      ...(filter?.status ? { status: filter.status } : {}),
    },
    orderBy: { plate: "asc" },
  });
}

export function getVehicleForTenant(ctx: TenantContext, vehicleId: string) {
  return prisma.vehicle.findFirst({
    where: { id: vehicleId, companyId: ctx.companyId },
  });
}

/** Plate numbers are unique across the whole platform, not just per tenant. */
export function findVehicleByPlate(plate: string) {
  return prisma.vehicle.findUnique({ where: { plate } });
}

export function createVehicleRecord(ctx: TenantContext, data: VehicleInput) {
  return prisma.vehicle.create({
    data: { ...data, companyId: ctx.companyId },
  });
}

export function updateVehicleRecord(
  ctx: TenantContext,
  vehicleId: string,
  data: VehicleInput
) {
  return prisma.vehicle.updateMany({
    where: { id: vehicleId, companyId: ctx.companyId },
    data,
  });
}

export function deleteVehicleRecord(ctx: TenantContext, vehicleId: string) {
  return prisma.vehicle.deleteMany({
    where: { id: vehicleId, companyId: ctx.companyId },
  });
}

export function countVehiclesByStatus(ctx: TenantContext) {
  return prisma.vehicle.groupBy({
    by: ["status"],
    where: { companyId: ctx.companyId },
    _count: true,
  });
}

export function countVehiclesByTypeAndStatus(ctx: TenantContext) {
  return prisma.vehicle.groupBy({
    by: ["vehicleType", "status"],
    where: { companyId: ctx.companyId },
    _count: true,
  });
}
