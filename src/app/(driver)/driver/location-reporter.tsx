"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

import { updateShipmentLocationAction } from "@/app/(driver)/driver/actions";

const MIN_SEND_INTERVAL_MS = 30_000;

/**
 * Renders nothing but a small status hint — the actual work is a
 * `navigator.geolocation.watchPosition` subscription (browser-native, free,
 * no API key, no third-party service) that fires updateShipmentLocationAction
 * at most once every MIN_SEND_INTERVAL_MS regardless of how often the
 * browser reports a change, so a driver sitting still with a jittery GPS
 * fix doesn't spam the server. Silently does nothing if geolocation is
 * unsupported or permission is denied — this is a nice-to-have overlay on
 * top of the required status-reporting flow, never something that should
 * block or alarm the driver.
 */
export function LocationReporter({ shipmentId }: { shipmentId: string }) {
  const [status, setStatus] = useState<"idle" | "sharing" | "denied" | "unsupported">(
    () => (typeof navigator !== "undefined" && "geolocation" in navigator ? "idle" : "unsupported")
  );
  const lastSentAt = useRef(0);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        if (now - lastSentAt.current < MIN_SEND_INTERVAL_MS) return;
        lastSentAt.current = now;
        setStatus("sharing");
        void updateShipmentLocationAction(
          shipmentId,
          position.coords.latitude,
          position.coords.longitude
        );
      },
      () => setStatus("denied"),
      { enableHighAccuracy: false, maximumAge: 20_000, timeout: 27_000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [shipmentId]);

  if (status !== "sharing") return null;
  return (
    <p className="text-muted-foreground flex items-center gap-1 text-xs">
      <MapPin className="size-3" />
      Canlı konumunuz paylaşılıyor
    </p>
  );
}
