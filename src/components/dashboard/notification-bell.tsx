"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";

import {
  fetchNotificationFeedAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/app/(dashboard)/notifications/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getNotificationLinkHref } from "@/core/notification/notification-links";
import { cn } from "@/lib/utils";

type NotificationFeed = Awaited<ReturnType<typeof fetchNotificationFeedAction>>;

const POLL_INTERVAL_MS = 20_000;

function formatRelativeTime(date: Date) {
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "az önce";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} dakika önce`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} saat önce`;
  const days = Math.round(hours / 24);
  return `${days} gün önce`;
}

export function NotificationBell({
  initialFeed,
}: {
  initialFeed: NotificationFeed;
}) {
  const [feed, setFeed] = useState(initialFeed);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      fetchNotificationFeedAction().then(setFeed);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  async function handleNotificationClick(notificationId: string) {
    setFeed((prev) => ({
      unreadCount: Math.max(0, prev.unreadCount - 1),
      notifications: prev.notifications.map((n) =>
        n.id === notificationId ? { ...n, isRead: true } : n
      ),
    }));
    await markNotificationReadAction(notificationId);
  }

  async function handleMarkAllRead() {
    setFeed((prev) => ({
      unreadCount: 0,
      notifications: prev.notifications.map((n) => ({ ...n, isRead: true })),
    }));
    await markAllNotificationsReadAction();
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell />
          {feed.unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-4 min-w-4 justify-center rounded-full px-1 text-[10px]"
            >
              {feed.unreadCount > 9 ? "9+" : feed.unreadCount}
            </Badge>
          )}
          <span className="sr-only">Bildirimler</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-sm font-medium">Bildirimler</span>
          {feed.unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-primary text-xs hover:underline"
            >
              Tümünü okundu işaretle
            </button>
          )}
        </div>
        {feed.notifications.length === 0 ? (
          <p className="text-muted-foreground px-2 py-6 text-center text-sm">
            Henüz bildirim yok.
          </p>
        ) : (
          <div className="flex max-h-80 flex-col overflow-y-auto">
            {feed.notifications.map((notification) => (
              <Link
                key={notification.id}
                href={getNotificationLinkHref(notification)}
                onClick={() => {
                  setOpen(false);
                  if (!notification.isRead) {
                    handleNotificationClick(notification.id);
                  }
                }}
                className={cn(
                  "flex flex-col gap-0.5 border-b px-2 py-2 text-sm last:border-b-0 hover:bg-accent",
                  !notification.isRead && "bg-accent/50"
                )}
              >
                <span className="flex items-start gap-2">
                  {!notification.isRead && (
                    <span className="bg-primary mt-1.5 size-1.5 shrink-0 rounded-full" />
                  )}
                  <span>{notification.message}</span>
                </span>
                <span className="text-muted-foreground pl-3.5 text-xs">
                  {formatRelativeTime(notification.createdAt)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
