"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  MapPin,
  Navigation,
  Truck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import {
  customerShipmentStatusLabels,
  shipmentStatusLabels,
  statusBadgeVariant,
} from "@/lib/labels";
import { SHIPMENT_STATUS_SEQUENCE } from "@/core/shipment/shipment-transitions";
import { geocodeAddress, type LatLng } from "@/lib/geocode-client";
import type { TrackingShipment } from "@/core/shipment/shipment-service";

// Leaflet touches window at import — load the map client-only.
const LiveTrackingMap = dynamic(
  () =>
    import("@/components/dashboard/live-tracking-map").then(
      (m) => m.LiveTrackingMap
    ),
  {
    ssr: false,
    loading: () => (
      <div className="text-muted-foreground bg-muted flex h-full min-h-[440px] w-full items-center justify-center text-sm">
        Harita yükleniyor…
      </div>
    ),
  }
);

export function LiveTrackingBoard({
  shipments,
  companyType,
}: {
  shipments: TrackingShipment[];
  companyType: "SUPPLIER" | "CUSTOMER";
}) {
  const labels =
    companyType === "CUSTOMER"
      ? customerShipmentStatusLabels
      : shipmentStatusLabels;
  const otherPartyLabel = companyType === "SUPPLIER" ? "Müşteri" : "Tedarikçi";

  const [selectedId, setSelectedId] = useState<string | null>(
    shipments[0]?.id ?? null
  );
  const selected =
    shipments.find((s) => s.id === selectedId) ?? shipments[0] ?? null;

  // Geocoded origin/destination per shipment (client-side, cached) so a
  // shipment can appear on the map from its address even before live GPS.
  const [geo, setGeo] = useState<
    Record<string, { origin?: LatLng; dest?: LatLng }>
  >({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const s of shipments) {
        if (cancelled) break;
        if (geo[s.id]) continue;
        const origin = await geocodeAddress(s.origin);
        const dest = await geocodeAddress(s.destination);
        if (cancelled) break;
        if (origin || dest) {
          setGeo((prev) => ({
            ...prev,
            [s.id]: { origin: origin ?? undefined, dest: dest ?? undefined },
          }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipments]);

  // One marker per shipment at its best-known point: live GPS if shared,
  // otherwise the geocoded origin (rendered in a muted "not live" style).
  const markers = shipments.flatMap((s) => {
    const live = s.lat != null && s.lng != null;
    const point = live
      ? { lat: s.lat as number, lng: s.lng as number }
      : (geo[s.id]?.origin ?? null);
    if (!point) return [];
    return [
      {
        id: s.id,
        lat: point.lat,
        lng: point.lng,
        live,
        label: `${s.trackingNumber} · ${s.origin} → ${s.destination}`,
      },
    ];
  });

  const route = selected
    ? {
        origin: geo[selected.id]?.origin,
        dest: geo[selected.id]?.dest,
        current:
          selected.lat != null && selected.lng != null
            ? { lat: selected.lat, lng: selected.lng }
            : undefined,
      }
    : null;

  const onMapCount = markers.length;
  const liveCount = markers.filter((m) => m.live).length;

  if (shipments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="text-muted-foreground size-4" />
            Canlı Takip
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground py-8 text-center text-sm">
            Şu anda takip edilecek aktif sefer yok.
          </p>
        </CardContent>
      </Card>
    );
  }

  const currentIndex = selected
    ? SHIPMENT_STATUS_SEQUENCE.indexOf(selected.status)
    : -1;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Map */}
        <Card className="overflow-hidden p-0 lg:col-span-2">
          <div className="border-b px-5 py-3.5">
            <div className="flex items-center gap-2 text-base font-semibold">
              <MapPin className="text-muted-foreground size-4" />
              Canlı Takip Haritası
            </div>
            <p className="text-muted-foreground text-xs">
              {onMapCount > 0
                ? `${onMapCount} sefer haritada${liveCount > 0 ? ` · ${liveCount} canlı GPS` : ""} — canlı konum şoför paylaştıkça güncellenir`
                : "Sefer konumları hazırlanıyor…"}
            </p>
          </div>
          <div className="h-[440px] w-full">
            <LiveTrackingMap
              markers={markers}
              route={route}
              selectedId={selected?.id ?? null}
              onSelect={setSelectedId}
            />
          </div>
        </Card>

        {/* Selected shipment panel */}
        <Card className="flex flex-col">
          {selected ? (
            <>
              <CardHeader className="gap-1">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">
                    {selected.trackingNumber}
                  </CardTitle>
                  <Badge variant={statusBadgeVariant[selected.status]}>
                    {labels[selected.status]}
                  </Badge>
                </div>
                <p className="text-muted-foreground text-sm">
                  {selected.origin} → {selected.destination}
                </p>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                {/* Milestone timeline */}
                <div className="flex flex-col gap-0.5">
                  {SHIPMENT_STATUS_SEQUENCE.map((step, i) => {
                    const done = currentIndex > i;
                    const active = currentIndex === i;
                    return (
                      <div key={step} className="flex items-center gap-2.5 py-1">
                        {done || active ? (
                          <CheckCircle2
                            className={`size-4 shrink-0 ${active ? "text-brand" : "text-success"}`}
                          />
                        ) : (
                          <Circle className="text-muted-foreground/40 size-4 shrink-0" />
                        )}
                        <span
                          className={`text-sm ${
                            active
                              ? "font-semibold"
                              : done
                                ? ""
                                : "text-muted-foreground"
                          }`}
                        >
                          {labels[step]}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-auto flex flex-col gap-2 border-t pt-3 text-sm">
                  <Row label={otherPartyLabel} value={selected.otherParty} />
                  <Row label="Şoför" value={selected.driverName ?? "—"} />
                  <Row label="Araç" value={selected.vehiclePlate ?? "—"} />
                  <Row
                    label="Son Konum"
                    value={
                      selected.lastLocationAt
                        ? formatDateTime(selected.lastLocationAt)
                        : "Konum bekleniyor"
                    }
                  />
                  <Link
                    href={`/shipments/${selected.id}`}
                    className="text-primary mt-1 inline-flex items-center gap-1 text-sm font-medium hover:underline"
                  >
                    Sefer Detayı <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="text-muted-foreground py-8 text-center text-sm">
              Bir sefer seçin.
            </CardContent>
          )}
        </Card>
      </div>

      {/* Activity list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sefer Aktivitesi</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y">
          {shipments.map((s) => {
            const isSel = s.id === selected?.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedId(s.id)}
                className={`flex items-center gap-3 py-3 text-left transition-colors ${
                  isSel ? "bg-muted/50" : "hover:bg-muted/30"
                } -mx-2 rounded-md px-2`}
              >
                <span className="bg-brand/15 text-brand flex size-9 shrink-0 items-center justify-center rounded-lg">
                  <Truck className="size-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold">
                      {s.trackingNumber}
                    </span>
                    <Badge variant={statusBadgeVariant[s.status]} className="shrink-0">
                      {labels[s.status]}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground truncate text-xs">
                    {s.origin} → {s.destination} · {s.otherParty}
                  </p>
                </div>
                <div className="hidden w-40 shrink-0 items-center gap-2 sm:flex">
                  <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
                    <div
                      className="bg-brand h-full rounded-full"
                      style={{ width: `${s.progress}%` }}
                    />
                  </div>
                  <span className="text-muted-foreground w-9 text-right text-xs">
                    %{s.progress}
                  </span>
                </div>
                {s.lat != null && (
                  <Navigation className="text-brand size-4 shrink-0" />
                )}
              </button>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
