import Link from "next/link";
import { Check, MapPin, Truck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatDateTime } from "@/lib/format";
import { shipmentStatusLabels, statusBadgeVariant } from "@/lib/labels";
import {
  SHIPMENT_STATUS_SEQUENCE,
  getShipmentProgressPercent,
} from "@/core/shipment/shipment-transitions";
import type { ShipmentStatus } from "@/generated/prisma/enums";

type FeaturedShipment = {
  id: string;
  trackingNumber: number;
  originAddress: string;
  destinationAddress: string;
  status: ShipmentStatus;
  createdAt: Date;
  tonnage: { toString(): string };
  distanceKm: { toString(): string };
  vehicle: { plate: string } | null;
  driver: { fullName: string } | null;
} | null;

/**
 * The dashboard's "what's actually happening right now" panel — mirrors the
 * reference design's selected-shipment sidebar, but every field is real data
 * for whichever shipment getFeaturedShipmentForSupplier picked (see that
 * function for the "in motion, most recently touched" selection rule).
 * The route section reuses our own real workflow steps (SHIPMENT_STATUS_
 * SEQUENCE) as checkpoints, labeled with our actual status names rather than
 * invented city waypoints — there's no multi-stop geography in this schema,
 * only origin/destination and a status lifecycle.
 */
export function FeaturedShipmentPanel({
  shipment,
  history,
}: {
  shipment: FeaturedShipment;
  history: { toStatus: string; createdAt: Date }[];
}) {
  if (!shipment) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Öne Çıkan Sefer</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Henüz gösterilecek bir sefer yok.
          </p>
        </CardContent>
      </Card>
    );
  }

  const reachedAt = new Map<string, Date>(
    history.map((h) => [h.toStatus, h.createdAt])
  );
  reachedAt.set("PENDING", shipment.createdAt);
  const currentIndex = SHIPMENT_STATUS_SEQUENCE.indexOf(shipment.status);
  const progressPct = getShipmentProgressPercent(shipment.status);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex-row items-start justify-between gap-2">
        <div>
          <p className="text-muted-foreground font-mono text-xs">
            {shipment.trackingNumber}
          </p>
          <CardTitle className="mt-0.5 text-base">
            {shipment.originAddress} → {shipment.destinationAddress}
          </CardTitle>
        </div>
        <Badge variant={statusBadgeVariant[shipment.status]} className="shrink-0">
          {shipmentStatusLabels[shipment.status]}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-5">
        <div>
          <p className="text-muted-foreground mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
            <MapPin className="size-3.5" />
            Rota
          </p>
          <div className="relative flex flex-col gap-4 pl-1">
            <div
              className="absolute top-1 bottom-1 left-[9px] z-0 w-px"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(to bottom, var(--color-border) 0 4px, transparent 4px 8px)",
              }}
            />
            {SHIPMENT_STATUS_SEQUENCE.map((step, index) => {
              const at = reachedAt.get(step);
              const isCurrent = step === shipment.status;
              const isReached = at !== undefined;
              const isFuture = index > currentIndex;
              return (
                <div key={step} className="relative z-10 flex items-start gap-3">
                  <span
                    className={
                      "flex size-[18px] shrink-0 items-center justify-center rounded-full " +
                      (isCurrent
                        ? "bg-accent-blue text-accent-blue-foreground"
                        : isReached
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted border-border border")
                    }
                  >
                    {isReached && !isCurrent && <Check className="size-3" />}
                    {isCurrent && <Truck className="size-2.5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={
                        "text-sm leading-tight font-medium " +
                        (isFuture ? "text-muted-foreground font-normal" : "")
                      }
                    >
                      {shipmentStatusLabels[step]}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {isCurrent ? "Şu an" : at ? formatDateTime(at) : "Bekliyor"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <Separator />

        <div>
          <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
            Sefer Detayları
          </p>
          <div className="grid grid-cols-2 gap-y-2.5 text-sm">
            <span className="text-muted-foreground">Araç</span>
            <span className="text-right font-medium">
              {shipment.vehicle?.plate ?? "Henüz atanmadı"}
            </span>
            <span className="text-muted-foreground">Şoför</span>
            <span className="text-right font-medium">
              {shipment.driver?.fullName ?? "Henüz atanmadı"}
            </span>
            <span className="text-muted-foreground">Tonaj</span>
            <span className="text-right font-medium">
              {shipment.tonnage.toString()} ton
            </span>
            <span className="text-muted-foreground">Mesafe</span>
            <span className="text-right font-medium">
              ~{shipment.distanceKm.toString()} km
            </span>
            <span className="text-muted-foreground">İlerleme</span>
            <span className="text-right font-medium">%{progressPct}</span>
          </div>
        </div>

        <Link
          href={`/shipments/${shipment.id}`}
          className="border-input hover:bg-accent mt-auto flex items-center justify-center rounded-lg border py-2.5 text-sm font-semibold transition-colors"
        >
          Tüm Detayları Gör
        </Link>
      </CardContent>
    </Card>
  );
}
