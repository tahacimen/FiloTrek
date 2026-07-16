import { prisma } from "@/lib/db";
import type { TenantContext } from "@/core/shared/tenant-context";
import type { DockInput, WarehouseInput } from "@/lib/validation/warehouse";

const dockWithHours = {
  workingHours: { orderBy: { dayOfWeek: "asc" } as const },
} as const;

export function listWarehousesForTenant(ctx: TenantContext) {
  return prisma.warehouse.findMany({
    where: { companyId: ctx.companyId },
    include: { docks: { include: dockWithHours, orderBy: { name: "asc" } } },
    orderBy: { name: "asc" },
  });
}

export function getWarehouseForTenant(ctx: TenantContext, warehouseId: string) {
  return prisma.warehouse.findFirst({
    where: { id: warehouseId, companyId: ctx.companyId },
  });
}

export function createWarehouseRecord(ctx: TenantContext, data: WarehouseInput) {
  return prisma.warehouse.create({
    data: { ...data, companyId: ctx.companyId },
  });
}

/**
 * Tenant-scoped through the warehouse relation rather than a direct
 * companyId column on LoadingDock — Prisma supports relation filters in
 * findFirst/updateMany's `where`, so this stays a single atomic query
 * rather than a separate "does this belong to the tenant" check-then-write.
 */
export function getDockForTenant(ctx: TenantContext, dockId: string) {
  return prisma.loadingDock.findFirst({
    where: { id: dockId, warehouse: { companyId: ctx.companyId } },
    include: { ...dockWithHours, warehouse: { select: { id: true, name: true } } },
  });
}

/** Caller (service) must confirm warehouseId belongs to the tenant first — see getWarehouseForTenant. */
export function createDockRecord(warehouseId: string, data: DockInput) {
  const { workingHours, ...dock } = data;
  return prisma.loadingDock.create({
    data: {
      ...dock,
      warehouseId,
      workingHours: { createMany: { data: workingHours } },
    },
    include: dockWithHours,
  });
}

export async function updateDockRecord(
  ctx: TenantContext,
  dockId: string,
  data: DockInput
) {
  const { workingHours, ...dock } = data;
  return prisma.$transaction(async (tx) => {
    const existing = await tx.loadingDock.findFirst({
      where: { id: dockId, warehouse: { companyId: ctx.companyId } },
      select: { id: true },
    });
    if (!existing) return null;

    await tx.loadingDock.update({ where: { id: dockId }, data: dock });
    // Full-replace is simplest and safe here: working hours always submit
    // as a complete 7-row array from the form, never a partial patch.
    await tx.dockWorkingHours.deleteMany({ where: { dockId } });
    await tx.dockWorkingHours.createMany({
      data: workingHours.map((row) => ({ ...row, dockId })),
    });
    return tx.loadingDock.findUniqueOrThrow({
      where: { id: dockId },
      include: dockWithHours,
    });
  });
}
