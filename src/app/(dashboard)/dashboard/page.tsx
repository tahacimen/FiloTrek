import Link from "next/link";
import { Truck } from "lucide-react";

import { requireTenantContext } from "@/core/shared/tenant-context";
import { getDashboardData, getOperationalKpis } from "@/core/dashboard/dashboard-service";
import { getSupplierScorecard } from "@/core/scorecard/scorecard-service";
import { getCompanyEmissionsSummary } from "@/core/emissions/emissions-service";
import { listShipments } from "@/core/shipment/shipment-service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { MonthlyRevenueChart } from "@/components/dashboard/monthly-revenue-chart";
import { StatusBreakdownChart } from "@/components/dashboard/status-breakdown-chart";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { FeaturedShipmentPanel } from "@/components/dashboard/featured-shipment-panel";
import { ScorecardCard } from "@/components/dashboard/scorecard-card";
import { OperationalKpiCard } from "@/components/dashboard/operational-kpi-card";
import { CarbonFootprintCard } from "@/components/dashboard/carbon-footprint-card";
import { Reveal } from "@/components/motion/reveal";
import { customerShipmentStatusLabels } from "@/lib/labels";

export default async function DashboardPage() {
  const ctx = await requireTenantContext();

  if (ctx.companyType === "CUSTOMER") {
    const [shipments, operationalKpis, emissionsSummary] = await Promise.all([
      listShipments(ctx),
      getOperationalKpis(ctx),
      getCompanyEmissionsSummary(ctx),
    ]);
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

        <Reveal>
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
        </Reveal>

        <Reveal delay={90}>
          <Card>
            <CardHeader>
              <CardTitle>Sefer Durumu Dağılımı ({shipments.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <StatusBreakdownChart
                counts={counts}
                labels={customerShipmentStatusLabels}
                unitLabel="Sefer"
              />
            </CardContent>
          </Card>
        </Reveal>

        <Reveal delay={180}>
          <OperationalKpiCard kpis={operationalKpis} />
        </Reveal>

        <Reveal delay={270}>
          <CarbonFootprintCard summary={emissionsSummary} />
        </Reveal>
      </div>
    );
  }

  const [data, scorecard, emissionsSummary] = await Promise.all([
    getDashboardData(ctx),
    getSupplierScorecard(ctx.companyId),
    getCompanyEmissionsSummary(ctx),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Gösterge Paneli</h1>
        <p className="text-muted-foreground text-sm">
          Filonuzun anlık durumuna genel bakış.
        </p>
      </div>

      <Reveal>
        <ScorecardCard scorecard={scorecard} />
      </Reveal>

      <KpiCards
        totalVehicles={data.totalVehicles}
        availableVehicles={data.availableVehicles}
        enRouteVehicles={data.enRouteVehicles}
        idleDrivers={data.idleDrivers}
      />

      <Reveal as="div" className="grid items-stretch gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Aylık Ciro & Sefer (Son 6 Ay)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 items-center">
            <MonthlyRevenueChart data={data.monthlyRevenueTrend} />
          </CardContent>
        </Card>

        <FeaturedShipmentPanel
          shipment={data.featuredShipment}
          history={data.featuredShipmentHistory}
        />
      </Reveal>

      <Reveal>
        <OperationalKpiCard kpis={data.operationalKpis} />
      </Reveal>

      <Reveal delay={90}>
        <CarbonFootprintCard summary={emissionsSummary} />
      </Reveal>

      <Reveal delay={180}>
        <ActivityFeed rows={data.recentActivity} />
      </Reveal>
    </div>
  );
}
