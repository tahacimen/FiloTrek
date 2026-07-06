import { CheckCircle2, Truck, UserCheck, Waypoints } from "lucide-react";

function KpiCard({
  label,
  value,
  icon: Icon,
  chipClassName,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  chipClassName: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div
        className={`mb-3 flex size-10 items-center justify-center rounded-full ${chipClassName}`}
      >
        <Icon className="size-5" />
      </div>
      <p className="text-muted-foreground mb-1 text-sm">{label}</p>
      <p className="text-3xl font-extrabold tracking-tight">{value}</p>
    </div>
  );
}

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
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <KpiCard
        label="Toplam Araç"
        value={totalVehicles}
        icon={Truck}
        chipClassName="bg-primary/10 text-primary"
      />
      <KpiCard
        label="Müsait Araç"
        value={availableVehicles}
        icon={CheckCircle2}
        chipClassName="bg-success/15 text-success"
      />
      <KpiCard
        label="Yoldaki Araç"
        value={enRouteVehicles}
        icon={Waypoints}
        chipClassName="bg-brand/15 text-brand"
      />
      <KpiCard
        label="Boştaki Şoför"
        value={idleDrivers}
        icon={UserCheck}
        chipClassName="bg-accent-blue/15 text-accent-blue"
      />
    </div>
  );
}
