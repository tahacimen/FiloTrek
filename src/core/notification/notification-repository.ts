import { prisma } from "@/lib/db";
import type { TenantContext } from "@/core/shared/tenant-context";
import { NotificationType } from "@/generated/prisma/client";

export function createNotification(data: {
  companyId: string;
  type: NotificationType;
  message: string;
  relatedShipmentId?: string;
}) {
  return prisma.notification.create({ data });
}

export function listRecentNotificationsForTenant(
  ctx: TenantContext,
  limit: number
) {
  return prisma.notification.findMany({
    where: { companyId: ctx.companyId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      message: true,
      isRead: true,
      relatedShipmentId: true,
      createdAt: true,
    },
  });
}

export function countUnreadForTenant(ctx: TenantContext) {
  return prisma.notification.count({
    where: { companyId: ctx.companyId, isRead: false },
  });
}

export function findNotificationForTenant(
  ctx: TenantContext,
  notificationId: string
) {
  return prisma.notification.findFirst({
    where: { id: notificationId, companyId: ctx.companyId },
  });
}

export function markNotificationRead(notificationId: string) {
  return prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true, readAt: new Date() },
  });
}

export function markAllNotificationsRead(ctx: TenantContext) {
  return prisma.notification.updateMany({
    where: { companyId: ctx.companyId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
}
