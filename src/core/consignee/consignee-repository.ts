import { prisma } from "@/lib/db";
import type { TenantContext } from "@/core/shared/tenant-context";
import type { ConsigneeInput } from "@/lib/validation/consignee";

export function listConsigneesForTenant(ctx: TenantContext) {
  return prisma.customerConsignee.findMany({
    where: { customerCompanyId: ctx.companyId, isActive: true },
    orderBy: { title: "asc" },
  });
}

export function getConsigneeForTenant(ctx: TenantContext, id: string) {
  return prisma.customerConsignee.findFirst({
    where: { id, customerCompanyId: ctx.companyId },
  });
}

export function createConsigneeRecord(ctx: TenantContext, data: ConsigneeInput) {
  return prisma.customerConsignee.create({
    data: { ...data, customerCompanyId: ctx.companyId },
  });
}

export function updateConsigneeRecord(
  ctx: TenantContext,
  id: string,
  data: ConsigneeInput
) {
  return prisma.customerConsignee.updateMany({
    where: { id, customerCompanyId: ctx.companyId },
    data,
  });
}

/** Soft delete — keeps the row so past shipments' denormalized destinations
 * stay explainable, but drops it from the picker/list. */
export function deactivateConsigneeRecord(ctx: TenantContext, id: string) {
  return prisma.customerConsignee.updateMany({
    where: { id, customerCompanyId: ctx.companyId },
    data: { isActive: false },
  });
}
