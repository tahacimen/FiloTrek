import { Check, X } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  customerShipmentStatusLabels,
  shipmentStatusLabels,
} from "@/lib/labels";
import { SHIPMENT_STATUS_SEQUENCE } from "@/core/shipment/shipment-transitions";
import type { ShipmentStatus } from "@/generated/prisma/enums";

/**
 * Step-by-step timeline of the shipment's own lifecycle, with the date/time
 * each step was reached — visible to both SUPPLIER and CUSTOMER, each with
 * their own perspective-specific label (see customerShipmentStatusLabels).
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sefer Durumu</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col">
          {SHIPMENT_STATUS_SEQUENCE.map((step) => {
            const at = reachedAt.get(step);
            const isReached = at !== undefined;
            const stepIndex = SHIPMENT_STATUS_SEQUENCE.indexOf(step);
            const isCurrent = !isCancelled && stepIndex === currentIndex;
            const isFuture = isCancelled ? !isReached : stepIndex > currentIndex;

            return (
              <li key={step} className="flex items-center gap-3 py-1.5">
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs",
                    isCurrent
                      ? "border-primary bg-primary text-primary-foreground"
                      : isReached
                        ? "border-success bg-success text-success-foreground"
                        : "border-border text-muted-foreground"
                  )}
                >
                  {isReached && <Check className="size-3.5" />}
                </span>
                <span
                  className={cn(
                    "flex-1 text-sm font-medium",
                    isFuture && "text-muted-foreground"
                  )}
                >
                  {labels[step]}
                </span>
                <span className="text-muted-foreground text-xs">
                  {at ? formatDateTime(at) : "—"}
                </span>
              </li>
            );
          })}
          {isCancelled && (
            <li className="flex items-center gap-3 py-1.5">
              <span className="border-destructive bg-destructive text-destructive-foreground flex size-6 shrink-0 items-center justify-center rounded-full border text-xs">
                <X className="size-3.5" />
              </span>
              <span className="text-destructive flex-1 text-sm font-medium">
                İptal Edildi
              </span>
              <span className="text-muted-foreground text-xs">
                {reachedAt.get("CANCELLED")
                  ? formatDateTime(reachedAt.get("CANCELLED")!)
                  : "—"}
              </span>
            </li>
          )}
        </ol>
      </CardContent>
    </Card>
  );
}
