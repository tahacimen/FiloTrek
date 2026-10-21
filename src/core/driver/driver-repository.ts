import { prisma } from "@/lib/db";
import type { TenantContext } from "@/core/shared/tenant-context";
import {
  DriverDeactivationReason,
  DriverStatus,
} from "@/generated/prisma/client";

export function listDriversForTenant(
  ctx: TenantContext,
  filter?: { status?: DriverStatus; assignableOnly?: boolean }
) {
  // assignableOnly (used by the assignment screen) narrows at the DB level to
  // drivers that can actually take a new shipment right now: active, and not
  // on leave today. The stored-status filter still excludes ON_TRIP/OFF_DUTY;
  // the leave window is a date range so it's expressed here rather than via
  // the status column. Mirrors isDriverAssignable in src/lib/driver-status.ts.
  // Stored leave dates are midnight-anchored, so compare against the start of
  // today (a leave whose end day is today still counts as on leave today).
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return prisma.driver.findMany({
    where: {
      companyId: ctx.companyId,
      ...(filter?.status ? { status: filter.status } : {}),
      ...(filter?.assignableOnly
        ? {
            isActive: true,
            OR: [
              { leaveStartDate: null },
              { leaveEndDate: null },
              { leaveEndDate: { lt: startOfToday } },
              { leaveStartDate: { gt: startOfToday } },
            ],
          }
        : {}),
    },
    orderBy: { fullName: "asc" },
  });
}

export function getDriverForTenant(ctx: TenantContext, driverId: string) {
  return prisma.driver.findFirst({
    where: { id: driverId, companyId: ctx.companyId },
  });
}

/**
 * Minimal, server-only lookup for emailing a specific driver directly
 * (e.g. the load-ready pickup link) — deliberately NOT added to
 * shipmentListInclude in shipment-repository.ts, which already goes out of
 * its way to only select {id, fullName} for the driver relation; email is
 * PII in the same spirit as passwordHash/tcNumber, no reason to widen what
 * every shipment list/detail consumer (including client components) gets.
 */
export function getDriverContactById(driverId: string) {
  return prisma.driver.findUnique({
    where: { id: driverId },
    select: { email: true, fullName: true },
  });
}

/** License numbers are unique across the whole platform, not just per tenant. */
export function findDriverByLicenseNumber(licenseNumber: string) {
  return prisma.driver.findUnique({ where: { licenseNumber } });
}

/**
 * User.email and Driver.email are two independent unique constraints —
 * nothing at the DB level stops the same address existing in both (e.g. an
 * owner-operator who is both the ADMIN dispatcher and personally drives).
 * Checked at write time from driver-service.ts whenever a Driver's email is
 * set/changed, so `authorize()` in auth.ts has a clean, unambiguous
 * User-then-Driver tiebreak instead of a real collision to resolve.
 */
export async function isEmailUsedByCompanyUser(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  return user !== null;
}

type CreateDriverRecordInput = {
  fullName: string;
  phone: string;
  licenseNumber: string;
  email?: string | null;
  passwordHash?: string | null;
  loginToken?: string | null;
  tcNumber?: string | null;
  experienceYears?: number | null;
};

export function createDriverRecord(
  ctx: TenantContext,
  data: CreateDriverRecordInput
) {
  return prisma.driver.create({
    data: { ...data, companyId: ctx.companyId },
  });
}

type UpdateDriverRecordInput = Partial<CreateDriverRecordInput>;

export function updateDriverRecord(
  ctx: TenantContext,
  driverId: string,
  data: UpdateDriverRecordInput
) {
  return prisma.driver.updateMany({
    where: { id: driverId, companyId: ctx.companyId },
    data,
  });
}

export function setDriverLoginToken(
  ctx: TenantContext,
  driverId: string,
  token: string | null
) {
  return prisma.driver.updateMany({
    where: { id: driverId, companyId: ctx.companyId },
    data: { loginToken: token },
  });
}

export function deleteDriverRecord(ctx: TenantContext, driverId: string) {
  return prisma.driver.deleteMany({
    where: { id: driverId, companyId: ctx.companyId },
  });
}

/** N2: the dispatcher's manual Müsait ↔ Görevde Değil toggle. */
export function setDriverStatusRecord(
  ctx: TenantContext,
  driverId: string,
  status: DriverStatus
) {
  return prisma.driver.updateMany({
    where: { id: driverId, companyId: ctx.companyId },
    data: { status },
  });
}

/** N2: set or clear a driver's leave window. */
export function setDriverLeaveRecord(
  ctx: TenantContext,
  driverId: string,
  data: { leaveStartDate: Date | null; leaveEndDate: Date | null }
) {
  return prisma.driver.updateMany({
    where: { id: driverId, companyId: ctx.companyId },
    data,
  });
}

/** N7: flip a driver's activation (deactivate with reason / reactivate clears it). */
export function setDriverActivationRecord(
  ctx: TenantContext,
  driverId: string,
  data: {
    isActive: boolean;
    deactivationReason: DriverDeactivationReason | null;
    deactivationNote: string | null;
    deactivatedAt: Date | null;
  }
) {
  return prisma.driver.updateMany({
    where: { id: driverId, companyId: ctx.companyId },
    data,
  });
}

export function countDriversByStatus(ctx: TenantContext) {
  return prisma.driver.groupBy({
    by: ["status"],
    where: { companyId: ctx.companyId },
    _count: true,
  });
}
