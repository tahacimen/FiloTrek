import { requireCompanyType } from "@/core/shared/authorization";
import type { TenantContext } from "@/core/shared/tenant-context";
import { NotFoundError } from "@/core/shared/errors";
import * as warehouseRepository from "@/core/warehouse/warehouse-repository";
import {
  dockInputSchema,
  warehouseInputSchema,
} from "@/lib/validation/warehouse";
import { CompanyType } from "@/generated/prisma/client";

export async function listWarehouses(ctx: TenantContext) {
  requireCompanyType(ctx, CompanyType.SUPPLIER);
  return warehouseRepository.listWarehousesForTenant(ctx);
}

export async function createWarehouse(ctx: TenantContext, rawInput: unknown) {
  requireCompanyType(ctx, CompanyType.SUPPLIER);
  const input = warehouseInputSchema.parse(rawInput);
  return warehouseRepository.createWarehouseRecord(ctx, input);
}

export async function getDock(ctx: TenantContext, dockId: string) {
  requireCompanyType(ctx, CompanyType.SUPPLIER);
  const dock = await warehouseRepository.getDockForTenant(ctx, dockId);
  if (!dock) throw new NotFoundError("Rampa bulunamadı.");
  return dock;
}

export async function createDock(
  ctx: TenantContext,
  warehouseId: string,
  rawInput: unknown
) {
  requireCompanyType(ctx, CompanyType.SUPPLIER);
  const warehouse = await warehouseRepository.getWarehouseForTenant(
    ctx,
    warehouseId
  );
  if (!warehouse) throw new NotFoundError("Depo bulunamadı.");

  const input = dockInputSchema.parse(rawInput);
  return warehouseRepository.createDockRecord(warehouseId, input);
}

export async function updateDock(
  ctx: TenantContext,
  dockId: string,
  rawInput: unknown
) {
  requireCompanyType(ctx, CompanyType.SUPPLIER);
  const input = dockInputSchema.parse(rawInput);
  const updated = await warehouseRepository.updateDockRecord(
    ctx,
    dockId,
    input
  );
  if (!updated) throw new NotFoundError("Rampa bulunamadı.");
  return updated;
}
