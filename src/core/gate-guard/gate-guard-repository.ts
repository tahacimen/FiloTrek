import { prisma } from "@/lib/db";
import type { TenantContext } from "@/core/shared/tenant-context";

export function listGateGuardsForTenant(ctx: TenantContext) {
  return prisma.gateGuard.findMany({
    where: { companyId: ctx.companyId },
    orderBy: { fullName: "asc" },
  });
}

export function getGateGuardForTenant(ctx: TenantContext, gateGuardId: string) {
  return prisma.gateGuard.findFirst({
    where: { id: gateGuardId, companyId: ctx.companyId },
  });
}

export function findGateGuardByEmail(email: string) {
  return prisma.gateGuard.findUnique({ where: { email } });
}

/**
 * Same cross-table collision check Driver does against User (see
 * assertEmailNotUsedByCompanyUser in driver-service.ts) — extended to also
 * check Driver, since a gate guard is a third independent account table
 * with its own unique-email constraint.
 */
export async function isEmailUsedByUserOrDriver(email: string) {
  const [user, driver] = await Promise.all([
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
    prisma.driver.findUnique({ where: { email }, select: { id: true } }),
  ]);
  return user !== null || driver !== null;
}

type CreateGateGuardRecordInput = {
  fullName: string;
  email: string;
  passwordHash: string;
};

export function createGateGuardRecord(
  ctx: TenantContext,
  data: CreateGateGuardRecordInput
) {
  return prisma.gateGuard.create({
    data: { ...data, companyId: ctx.companyId },
  });
}

type UpdateGateGuardRecordInput = Partial<CreateGateGuardRecordInput> & {
  isActive?: boolean;
};

export function updateGateGuardRecord(
  ctx: TenantContext,
  gateGuardId: string,
  data: UpdateGateGuardRecordInput
) {
  return prisma.gateGuard.updateMany({
    where: { id: gateGuardId, companyId: ctx.companyId },
    data,
  });
}

export function deleteGateGuardRecord(ctx: TenantContext, gateGuardId: string) {
  return prisma.gateGuard.deleteMany({
    where: { id: gateGuardId, companyId: ctx.companyId },
  });
}
