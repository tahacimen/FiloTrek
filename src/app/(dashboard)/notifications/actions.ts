"use server";

import { revalidatePath } from "next/cache";

import { requireTenantContext } from "@/core/shared/tenant-context";
import * as notificationService from "@/core/notification/notification-service";
import { toActionErrorMessage } from "@/lib/action-error";

export async function fetchNotificationFeedAction() {
  const ctx = await requireTenantContext();
  return notificationService.listRecentNotifications(ctx);
}

export async function markNotificationReadAction(notificationId: string) {
  try {
    const ctx = await requireTenantContext();
    await notificationService.markAsRead(ctx, notificationId);
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath("/assign");
  return undefined;
}

export async function markAllNotificationsReadAction() {
  try {
    const ctx = await requireTenantContext();
    await notificationService.markAllAsRead(ctx);
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  return undefined;
}
