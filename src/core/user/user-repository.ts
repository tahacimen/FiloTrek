import { prisma } from "@/lib/db";

/**
 * Notification is company-scoped (a shared team inbox — see the model
 * comment in schema.prisma), but email needs actual per-user addresses.
 * This is that lookup — nothing in this codebase needed it before email.
 */
export function listActiveUserEmails(companyId: string) {
  return prisma.user.findMany({
    where: { companyId, isActive: true },
    select: { email: true },
  });
}
