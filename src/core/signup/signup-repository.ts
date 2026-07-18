import { prisma } from "@/lib/db";
import {
  InvitationRole,
  SignupRequestStatus,
} from "@/generated/prisma/client";

export function createSignupRequest(data: {
  companyName: string;
  fullName: string;
  email: string;
  phone?: string | null;
  role: InvitationRole;
  message?: string | null;
}) {
  return prisma.signupRequest.create({ data });
}

export function listSignupRequests() {
  return prisma.signupRequest.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
}

export function findSignupRequestById(id: string) {
  return prisma.signupRequest.findUnique({ where: { id } });
}

export function findPendingSignupRequestByEmail(email: string) {
  return prisma.signupRequest.findFirst({
    where: { email, status: SignupRequestStatus.PENDING },
  });
}

export function updateSignupRequestStatus(
  id: string,
  status: SignupRequestStatus
) {
  return prisma.signupRequest.update({ where: { id }, data: { status } });
}

/**
 * Distinct company ids of every platform admin — the notification model is
 * company-scoped, so a signup request fans out to the company of each admin
 * who could act on it (usually just one).
 */
export async function platformAdminCompanyIds(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { isPlatformAdmin: true, isActive: true },
    select: { companyId: true },
  });
  return [...new Set(admins.map((a) => a.companyId))];
}
