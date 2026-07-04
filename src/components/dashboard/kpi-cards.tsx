import { Package, Truck, UserCheck, Waypoints } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function KpiCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-muted-foreground text-sm font-medium">
          {label}
        </CardTitle>
        <Icon className="text-muted-foreground size-4" />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
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
      <KpiCard label="Toplam Araç" value={totalVehicles} icon={Truck} />
      <KpiCard label="Müsait Araç" value={availableVehicles} icon={Package} />
      <KpiCard label="Yoldaki Araç" value={enRouteVehicles} icon={Waypoints} />
      <KpiCard label="Boştaki Şoför" value={idleDrivers} icon={UserCheck} />
    </div>
  );
}
