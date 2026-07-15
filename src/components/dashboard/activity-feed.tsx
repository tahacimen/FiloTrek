import Link from "next/link";
import { AlertTriangle, CheckCircle2, Truck, XCircle } from "lucide-react";

import { shipmentStatusLabels, statusBadgeVariant } from "@/lib/labels";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/format";
import { getShipmentProgressPercent } from "@/core/shipment/shipment-transitions";
import { ShipmentStatus } from "@/generated/prisma/enums";

type ActivityRow = {
  id: string;
  trackingNumber: number;
  originAddress: string;
  destinationAddress: string;
  status: ShipmentStatus;
  updatedAt: Date;
  hasOpenIncident: boolean;
  vehicle: { plate: string } | null;
  driver: { fullName: string } | null;
};

const ICON_STYLE: Record<
  "completed" | "cancelled" | "incident" | "default",
  { icon: React.ComponentType<{ className?: string }>; className: string }
> = {
  completed: { icon: CheckCircle2, className: "bg-success/15 text-success" },
  cancelled: { icon: XCircle, className: "bg-destructive/15 text-destructive" },
  incident: { icon: AlertTriangle, className: "bg-brand/15 text-brand" },
  default: { icon: Truck, className: "bg-accent-blue/15 text-accent-blue" },
};

function rowKind(row: ActivityRow) {
  if (row.hasOpenIncident) return "incident" as const;
  if (row.status === ShipmentStatus.COMPLETED) return "completed" as const;
  if (row.status === ShipmentStatus.CANCELLED) return "cancelled" as const;
  return "default" as const;
}

/**
 * The dashboard's "Sefer Aktivitesi" list — one real shipment per row:
 * tracking number, current status, route, and a progress bar driven by
 * getShipmentProgressPercent (the shipment's real position in
 * SHIPMENT_STATUS_SEQUENCE), matching the reference design's activity
 * table without inventing a percentage that isn't backed by the schema.
 * CANCELLED has no fixed position in that sequence (see the comment on
 * SHIPMENT_STATUS_SEQUENCE), so its bar is shown empty/destructive rather
 * than computed.
 */
export function ActivityFeed({ rows }: { rows: ActivityRow[] }) {
  return (
    <div className="flex h-full flex-col rounded-xl border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b p-4">
        <h2 className="text-base font-semibold">Sefer Aktivitesi</h2>
        <Link
          href="/shipments"
          className="text-sm font-medium text-primary hover:underline"
        >
          Tümünü Gör
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="text-muted-foreground p-6 text-center text-sm">
          Henüz aktivite bulunmuyor.
        </p>
      ) : (
        <div className="divide-y">
          {rows.map((row) => {
            const kind = rowKind(row);
            const { icon: Icon, className } = ICON_STYLE[kind];
            const isCancelled = row.status === ShipmentStatus.CANCELLED;
            const progressPct = isCancelled
              ? 0
              : getShipmentProgressPercent(row.status);
            return (
              <Link
                key={row.id}
                href={`/shipments/${row.id}`}
                className="hover:bg-muted/50 grid grid-cols-1 items-center gap-3 p-4 transition-colors sm:grid-cols-[auto_1fr_auto_9rem]"
              >
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-full ${className}`}
                >
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold">
                      {row.trackingNumber}
                    </span>
                    {row.hasOpenIncident && (
                      <Badge variant="destructive" className="text-[10px]">
                        Arıza
                      </Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground truncate text-xs">
                    {row.originAddress} → {row.destinationAddress}
                  </p>
                </div>
                <div className="flex flex-col items-start gap-1 sm:items-end">
                  <Badge variant={statusBadgeVariant[row.status]} className="text-xs">
                    {shipmentStatusLabels[row.status]}
                  </Badge>
                  <span className="text-muted-foreground text-[11px]">
                    {formatRelativeTime(row.updatedAt)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
                    <div
                      className={
                        "h-full rounded-full " +
                        (isCancelled ? "bg-destructive" : "bg-brand")
                      }
                      style={{ width: `${isCancelled ? 100 : progressPct}%` }}
                    />
                  </div>
                  <span className="text-muted-foreground w-8 shrink-0 text-right text-xs tabular-nums">
                    {isCancelled ? "—" : `${progressPct}%`}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
