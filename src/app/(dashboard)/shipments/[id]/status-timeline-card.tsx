import { Check, Truck, X } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  customerShipmentStatusLabels,
  shipmentStatusLabels,
} from "@/lib/labels";
import { SHIPMENT_STATUS_SEQUENCE } from "@/core/shipment/shipment-transitions";
import type { ShipmentStatus } from "@/generated/prisma/enums";

// Adım başına renk geçişi: baştan (turuncu) sona (yeşil) doğru "olgunlaşan"
// bir ilerleme ölçeği — son adım (COMPLETED / Tamamlandı) tam yeşil. İndeks,
// SHIPMENT_STATUS_SEQUENCE'teki sabit konuma göre atanır, böylece her durum
// her zaman aynı rengi taşır. Dizinin uzunluğuyla hizalı (8 adım).
const STEP_COLORS = [
  "#e0552e", // Atama Bekliyor
  "#ee7e28", // Atandı
  "#f5a312", // Yüklemeye Gidiyor
  "#e0b710", // Yüklemede
  "#bcc41c", // Yüklemeye Hazır
  "#8ec02a", // Yolda
  "#57b03f", // Teslimat Noktasında
  "#2e9e4b", // Tamamlandı (yeşil)
];
// Açık tonlu adımlarda koyu, koyu tonlularda beyaz ikon — okunabilirlik için.
const STEP_FG = [
  "#ffffff",
  "#ffffff",
  "#1a1a1a",
  "#1a1a1a",
  "#1a1a1a",
  "#1a1a1a",
  "#ffffff",
  "#ffffff",
];

/**
 * Horizontal step-by-step timeline of the shipment's own lifecycle, with the
 * date/time each step was reached — visible to both SUPPLIER and CUSTOMER,
 * each with their own perspective-specific label (see
 * customerShipmentStatusLabels). Scrolls horizontally on narrow screens
 * rather than wrapping, since a wrapped multi-row timeline reads as
 * disconnected steps instead of one continuous journey.
 *
 * CANCELLED isn't part of the fixed sequence (it can happen from any
 * non-terminal step) — handled as a trailing marker instead, so the
 * timeline reads as "here's how far it got before cancellation" rather
 * than a confusing dead branch in the middle of the happy path.
 */
export function StatusTimelineCard({
  status,
  createdAt,
  companyType,
  history,
}: {
  status: ShipmentStatus;
  createdAt: Date;
  companyType: "SUPPLIER" | "CUSTOMER";
  history: { toStatus: string; createdAt: Date }[];
}) {
  const labels =
    companyType === "CUSTOMER" ? customerShipmentStatusLabels : shipmentStatusLabels;

  // PENDING is the row's default at creation, not a recorded transition —
  // its "reached at" is simply when the shipment itself was created.
  const reachedAt = new Map<string, Date>(
    history.map((h) => [h.toStatus, h.createdAt])
  );
  reachedAt.set("PENDING", createdAt);

  const isCancelled = status === "CANCELLED";
  const currentIndex = SHIPMENT_STATUS_SEQUENCE.indexOf(status);
  const steps = isCancelled
    ? SHIPMENT_STATUS_SEQUENCE.slice(0, currentIndex + 1 || SHIPMENT_STATUS_SEQUENCE.length)
    : SHIPMENT_STATUS_SEQUENCE;
  const progressPct = isCancelled
    ? 100
    : (Math.max(currentIndex, 0) / (SHIPMENT_STATUS_SEQUENCE.length - 1)) * 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sefer Durumu</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto pb-1">
          <div className="relative flex min-w-[640px] items-start px-5 pt-4">
            <div className="absolute top-9 right-5 left-5 z-0 h-0.5">
              <div
                className="h-full w-full"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(to right, var(--color-border) 0 4px, transparent 4px 8px)",
                }}
              />
              <div
                className="absolute inset-y-0 left-0 h-full rounded-full"
                style={{
                  width: `${progressPct}%`,
                  // Gradient tüm parkuru temsil eder; yalnızca ulaşılan kısım
                  // görünür — böylece yeşil yalnızca sona yaklaşınca belirir.
                  backgroundImage: `linear-gradient(to right, ${STEP_COLORS.join(", ")})`,
                  backgroundSize: `${progressPct > 0 ? (100 / progressPct) * 100 : 100}% 100%`,
                  backgroundRepeat: "no-repeat",
                }}
              />
            </div>

            {steps.map((step) => {
              const at = reachedAt.get(step);
              const isReached = at !== undefined;
              const stepIndex = SHIPMENT_STATUS_SEQUENCE.indexOf(step);
              const isCurrent = !isCancelled && stepIndex === currentIndex;

              return (
                <div
                  key={step}
                  className="relative z-10 flex flex-1 flex-col items-center gap-1.5 px-1"
                >
                  <span
                    className={cn(
                      "ring-background flex shrink-0 items-center justify-center rounded-full ring-4 transition-all",
                      isCurrent ? "size-10 shadow-lg" : "size-8",
                      !isReached && !isCurrent &&
                        "bg-muted text-muted-foreground border-border border"
                    )}
                    style={
                      isReached || isCurrent
                        ? {
                            backgroundColor: STEP_COLORS[stepIndex],
                            color: STEP_FG[stepIndex],
                          }
                        : undefined
                    }
                  >
                    {isReached && !isCurrent && <Check className="size-4" />}
                    {isCurrent && <Truck className="size-[18px]" />}
                  </span>
                  <span
                    className={cn(
                      "text-center text-xs leading-tight font-semibold",
                      isReached || isCurrent
                        ? "text-foreground"
                        : "text-muted-foreground font-normal"
                    )}
                  >
                    {labels[step]}
                  </span>
                  <span className="text-muted-foreground text-center text-[11px]">
                    {isCurrent ? "Şu an" : at ? formatDateTime(at) : "—"}
                  </span>
                </div>
              );
            })}

            {isCancelled && (
              <div className="relative z-10 flex flex-1 flex-col items-center gap-1.5 px-1">
                <span className="ring-background bg-destructive text-destructive-foreground flex size-8 shrink-0 items-center justify-center rounded-full ring-4">
                  <X className="size-4" />
                </span>
                <span className="text-destructive text-center text-xs leading-tight font-semibold">
                  İptal Edildi
                </span>
                <span className="text-muted-foreground text-center text-[11px]">
                  {reachedAt.get("CANCELLED")
                    ? formatDateTime(reachedAt.get("CANCELLED")!)
                    : "—"}
                </span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
