"use client";

import dynamic from "next/dynamic";

// Leaflet touches `window`/`document` at module load (browser feature
// detection) — must never run during Next.js's server-side render pass.
// `ssr: false` can only be set where `dynamic()` itself is called from a
// Client Component, hence this thin wrapper: page.tsx (a Server Component)
// imports THIS file instead of shipment-live-map.tsx directly.
export const ShipmentLiveMap = dynamic(
  () => import("@/components/shipment-live-map").then((m) => m.ShipmentLiveMap),
  {
    ssr: false,
    loading: () => (
      <div className="bg-muted flex h-[260px] w-full items-center justify-center rounded-[var(--radius)] text-sm text-muted-foreground">
        Harita yükleniyor...
      </div>
    ),
  }
);
