"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Silently re-runs the current page's Server Components on an interval so a
 * list reflects another user's (or a driver's) changes without a manual
 * reload. Same "only poll while the tab is visible" guard as
 * notification-bell.tsx, but calling router.refresh() instead of a bespoke
 * Server Action + setState — there's no client-side UI state here worth
 * preserving across a refresh (unlike the notification dropdown's
 * open/closed state), so the simpler mechanism is enough.
 */
export function AutoRefresh({
  intervalMs = 20_000,
}: {
  intervalMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      router.refresh();
    }, intervalMs);
    return () => clearInterval(interval);
  }, [router, intervalMs]);

  return null;
}
