import { Star } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SupplierScorecard } from "@/core/scorecard/scorecard-service";

function formatPercent(ratio: number | null) {
  return ratio === null ? "—" : `%${Math.round(ratio * 100)}`;
}

export function ScorecardCard({ scorecard }: { scorecard: SupplierScorecard }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Performans Karnem</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">Ortalama Puan</span>
          <span className="flex items-center gap-1 text-xl font-semibold">
            {scorecard.averageRating !== null ? (
              <>
                <Star className="size-4 fill-yellow-400 text-yellow-400" />
                {scorecard.averageRating.toFixed(1)}
              </>
            ) : (
              "—"
            )}
          </span>
          <span className="text-muted-foreground text-xs">
            {scorecard.ratingCount} değerlendirme
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">Zamanında Teslim Alma</span>
          <span className="text-xl font-semibold">
            {formatPercent(scorecard.onTimePickupRate)}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">İptal Oranı</span>
          <span className="text-xl font-semibold">
            {formatPercent(scorecard.cancellationRate)}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">Tamamlanan Sefer</span>
          <span className="text-xl font-semibold">
            {scorecard.completedShipmentCount}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
