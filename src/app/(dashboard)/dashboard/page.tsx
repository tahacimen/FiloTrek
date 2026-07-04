import Link from "next/link";
import { Truck } from "lucide-react";

import { requireTenantContext } from "@/core/shared/tenant-context";
import { getDashboardData } from "@/core/dashboard/dashboard-service";
import { listShipments } from "@/core/shipment/shipment-service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { OccupancyChart } from "@/components/dashboard/occupancy-chart";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { StatusBreakdownChart } from "@/components/dashboard/status-breakdown-chart";
import {
  customerShipmentStatusLabels,
  driverStatusLabels,
  vehicleStatusLabels,
} from "@/lib/labels";

export default async function DashboardPage() {
  const ctx = await requireTenantContext();

  if (ctx.companyType === "CUSTOMER") {
    const shipments = await listShipments(ctx);
    const counts = shipments.reduce(
      (acc, s) => {
        acc[s.status] = (acc[s.status] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Gösterge Paneli</h1>
          <p className="text-muted-foreground text-sm">
            Firmanıza ait seferlerin genel durumu.
          </p>
        </div>

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="font-medium">Yeni bir yük için araç mı lazım?</p>
              <p className="text-muted-foreground text-sm">
                Tedarikçilerimizden birini seçip tek adımda araç talep edin.
              </p>
            </div>
            <Button asChild size="lg">
              <Link href="/shipments/request">
                <Truck />
                Araç Çağır
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sefer Durumu Dağılımı ({shipments.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBreakdownChart
              counts={counts}
              labels={customerShipmentStatusLabels}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const data = await getDashboardData(ctx);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Gösterge Paneli</h1>
        <p className="text-muted-foreground text-sm">
          Filonuzun anlık durumuna genel bakış.
        </p>
      </div>

      <KpiCards
        totalVehicles={data.totalVehicles}
        availableVehicles={data.availableVehicles}
        enRouteVehicles={data.enRouteVehicles}
        idleDrivers={data.idleDrivers}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Araç Tipine Göre Filo Doluluğu</CardTitle>
          </CardHeader>
          <CardContent>
            <OccupancyChart data={data.occupancyByType} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Şoför Durum Kırılımı</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBreakdownChart
              counts={data.driversByStatus}
              labels={driverStatusLabels}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Kapasite Kullanım Trendi (Son 14 Gün)</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart data={data.completedShipmentsTrend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Araç Durum Kırılımı</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBreakdownChart
              counts={data.vehiclesByStatus}
              labels={vehicleStatusLabels}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
