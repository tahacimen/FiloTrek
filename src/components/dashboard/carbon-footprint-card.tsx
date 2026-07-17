import { Leaf } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CompanyEmissionsSummary } from "@/core/emissions/emissions-service";

function formatKg(kg: number) {
  return kg >= 1000
    ? `${(kg / 1000).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} ton`
    : `${kg.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} kg`;
}

function formatMonthLabel(month: string) {
  const [year, monthNum] = month.split("-");
  return new Intl.DateTimeFormat("tr-TR", { month: "short", year: "2-digit" }).format(
    new Date(Number(year), Number(monthNum) - 1, 1)
  );
}

export function CarbonFootprintCard({
  summary,
}: {
  summary: CompanyEmissionsSummary;
}) {
  const recentMonths = summary.byMonth.slice(-6);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Leaf className="text-muted-foreground size-4" />
          Karbon Ayak İzi (Son 12 Ay, Tahmini)
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">Toplam CO2e</span>
          <span className="text-3xl font-extrabold tracking-tight">
            {formatKg(summary.totalKg)}
          </span>
        </div>
        {recentMonths.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {recentMonths.map((row) => (
              <div
                key={row.month}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-muted-foreground">
                  {formatMonthLabel(row.month)}
                </span>
                <span className="font-medium">{formatKg(row.kg)}</span>
              </div>
            ))}
          </div>
        )}
        <p className="text-muted-foreground text-xs">
          Araç tipine göre yaklaşık gCO2e/ton-km ortalamalarıyla hesaplanan bir
          tahmindir, ölçüm veya denetim niteliği taşımaz.
        </p>
      </CardContent>
    </Card>
  );
}
