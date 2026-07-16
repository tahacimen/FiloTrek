import { prisma } from "@/lib/db";
import { InvitationRole, InvitationStatus } from "@/generated/prisma/client";

/**
 * A brand-new Company's admin User must not collide with ANY existing login
 * identity — unlike gate-guard-repository's isEmailUsedByUserOrDriver (which
 * only needs User+Driver since a gate guard is created within an already-
 * known company), this also has to check GateGuard.
 */
export async function isEmailUsedAnywhere(email: string) {
  const [user, driver, gateGuard] = await Promise.all([
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
    prisma.driver.findUnique({ where: { email }, select: { id: true } }),
    prisma.gateGuard.findUnique({ where: { email }, select: { id: true } }),
  ]);
  return user !== null || driver !== null || gateGuard !== null;
}

export function findPendingInvitationByEmail(email: string) {
  return prisma.invitation.findFirst({
    where: { email, status: InvitationStatus.PENDING },
  });
}

type CreateInvitationRecordInput = {
  email: string;
  role: InvitationRole;
  token: string;
  expiresAt: Date;
  createdByUserId: string;
};

export function createInvitationRecord(data: CreateInvitationRecordInput) {
  return prisma.invitation.create({ data });
}

export function listInvitations() {
  return prisma.invitation.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export function findInvitationById(invitationId: string) {
  return prisma.invitation.findUnique({ where: { id: invitationId } });
}

export function findInvitationByToken(token: string) {
  return prisma.invitation.findUnique({ where: { token } });
}

export function markInvitationRevoked(invitationId: string) {
  return prisma.invitation.updateMany({
    where: { id: invitationId, status: InvitationStatus.PENDING },
    data: { status: InvitationStatus.REVOKED },
  });
}
