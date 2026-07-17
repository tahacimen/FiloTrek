import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendChart } from "@/components/dashboard/trend-chart";
import type { OperationalKpis } from "@/core/dashboard/dashboard-service";

function formatPercent(ratio: number | null) {
  return ratio === null ? "—" : `%${Math.round(ratio * 100)}`;
}

export function OperationalKpiCard({ kpis }: { kpis: OperationalKpis }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Derin Operasyonel KPI&apos;lar</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Zamanında Teslim Alma</span>
            <span className="text-xl font-semibold">
              {formatPercent(kpis.onTimePickupRate)}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Ortalama Fiyat/km</span>
            <span className="text-xl font-semibold">
              {kpis.averagePricePerKm !== null
                ? `${kpis.averagePricePerKm.toLocaleString("tr-TR", {
                    maximumFractionDigits: 2,
                  })} ₺`
                : "—"}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Arıza Oranı</span>
            <span className="text-xl font-semibold">
              {formatPercent(kpis.incidentRate)}
            </span>
          </div>
        </div>
        <div>
          <p className="text-muted-foreground mb-2 text-xs">
            Sefer Hacmi Trendi (Son 14 Gün)
          </p>
          <TrendChart data={kpis.shipmentVolumeTrend} seriesLabel="Sefer" />
        </div>
      </CardContent>
    </Card>
  );
}
