import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { TenantContext } from "@/core/shared/tenant-context";
import type { ContractRateInput } from "@/lib/validation/contract-rate";

export function listContractRatesForSupplier(ctx: TenantContext) {
  return prisma.supplierContractRate.findMany({
    where: { supplierCompanyId: ctx.companyId, isActive: true },
    include: { customerCompany: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export function getContractRateForSupplier(ctx: TenantContext, id: string) {
  return prisma.supplierContractRate.findFirst({
    where: { id, supplierCompanyId: ctx.companyId },
  });
}

export function createContractRateRecord(
  ctx: TenantContext,
  data: ContractRateInput
) {
  return prisma.supplierContractRate.create({
    data: { ...data, supplierCompanyId: ctx.companyId },
  });
}

export function updateContractRateRecord(
  ctx: TenantContext,
  id: string,
  data: ContractRateInput
) {
  return prisma.supplierContractRate.updateMany({
    where: { id, supplierCompanyId: ctx.companyId },
    data,
  });
}

export function deactivateContractRateRecord(ctx: TenantContext, id: string) {
  return prisma.supplierContractRate.updateMany({
    where: { id, supplierCompanyId: ctx.companyId },
    data: { isActive: false },
  });
}

/** All active rates for a (supplier, customer) pair — used by price matching. */
export function listActiveRatesForPair(
  client: Prisma.TransactionClient | typeof prisma,
  supplierCompanyId: string,
  customerCompanyId: string
) {
  return client.supplierContractRate.findMany({
    where: { supplierCompanyId, customerCompanyId, isActive: true },
  });
}
