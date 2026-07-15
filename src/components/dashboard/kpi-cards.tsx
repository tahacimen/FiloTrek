import { CheckCircle2, Truck, UserCheck, Waypoints } from "lucide-react";

import { Card } from "@/components/ui/card";

function KpiStat({
  label,
  value,
  icon: Icon,
  chipClassName,
  isLast,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  chipClassName: string;
  isLast: boolean;
}) {
  return (
    <div
      className={`flex flex-1 items-center gap-3.5 px-4 py-4 first:pl-5 sm:px-5 ${
        isLast ? "" : "border-b sm:border-r sm:border-b-0"
      }`}
    >
      <span
        className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${chipClassName}`}
      >
        <Icon className="size-5" />
      </span>
      <div>
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="text-2xl font-extrabold tracking-tight">{value}</p>
      </div>
    </div>
  );
}

/**
 * A single bordered strip split into four columns (not four separate
 * cards) — matches the reference dashboard's stat row. Every number here
 * is a live snapshot count; deliberately no trend arrows/percentages,
 * since nothing in the schema stores a historical fleet-status snapshot to
 * compare against (unlike completedShipmentsTrend, which genuinely has a
 * day-by-day history behind it).
 */
export function KpiCards({
  totalVehicles,
  availableVehicles,
  enRouteVehicles,
  idleDrivers,
}: {
  totalVehicles: number;
  availableVehicles: number;
  enRouteVehicles: number;
  idleDrivers: number;
}) {
  return (
    <Card className="flex flex-col gap-0 p-0 sm:flex-row">
      <KpiStat
        label="Toplam Araç"
        value={totalVehicles}
        icon={Truck}
        chipClassName="bg-primary/10 text-primary"
        isLast={false}
      />
      <KpiStat
        label="Müsait Araç"
        value={availableVehicles}
        icon={CheckCircle2}
        chipClassName="bg-success/15 text-success"
        isLast={false}
      />
      <KpiStat
        label="Yoldaki Araç"
        value={enRouteVehicles}
        icon={Waypoints}
        chipClassName="bg-brand/15 text-brand"
        isLast={false}
      />
      <KpiStat
        label="Boştaki Şoför"
        value={idleDrivers}
        icon={UserCheck}
        chipClassName="bg-accent-blue/15 text-accent-blue"
        isLast={true}
      />
    </Card>
  );
}
