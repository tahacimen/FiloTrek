import Link from "next/link";
import { AlertTriangle, CheckCircle2, Truck, XCircle } from "lucide-react";

import { shipmentStatusLabels } from "@/lib/labels";
import { formatRelativeTime } from "@/lib/format";
import { ShipmentStatus } from "@/generated/prisma/enums";

type ActivityRow = {
  id: string;
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

function describe(row: ActivityRow) {
  const route = `${row.originAddress} → ${row.destinationAddress}`;
  if (row.hasOpenIncident) {
    return {
      kind: "incident" as const,
      message: row.vehicle
        ? `${row.vehicle.plate} plakalı araç arıza bildirdi.`
        : `${route} seferinde arıza bildirildi.`,
      subtitle: row.driver ? `Şoför: ${row.driver.fullName}` : route,
    };
  }
  if (row.status === ShipmentStatus.COMPLETED) {
    return {
      kind: "completed" as const,
      message: row.vehicle
        ? `${row.vehicle.plate} plakalı araç teslimatı tamamladı.`
        : `${route} seferi tamamlandı.`,
      subtitle: route,
    };
  }
  if (row.status === ShipmentStatus.CANCELLED) {
    return {
      kind: "cancelled" as const,
      message: `${route} seferi iptal edildi.`,
      subtitle: route,
    };
  }
  return {
    kind: "default" as const,
    message: `${route} seferi "${shipmentStatusLabels[row.status]}" durumuna geçti.`,
    subtitle: row.vehicle?.plate ?? route,
  };
}

export function ActivityFeed({ rows }: { rows: ActivityRow[] }) {
  return (
    <div className="flex h-full flex-col rounded-xl border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b p-4">
        <h2 className="text-base font-semibold">Son Aktiviteler</h2>
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
        <div className="flex-1 divide-y overflow-y-auto">
          {rows.map((row) => {
            const { kind, message, subtitle } = describe(row);
            const { icon: Icon, className } = ICON_STYLE[kind];
            return (
              <Link
                key={row.id}
                href={`/shipments/${row.id}`}
                className="hover:bg-muted/50 flex items-start gap-3 p-4 transition-colors"
              >
                <span
                  className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${className}`}
                >
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm leading-snug">{message}</p>
                  <span className="text-muted-foreground text-xs">
                    {formatRelativeTime(row.updatedAt)} • {subtitle}
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
