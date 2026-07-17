"use client";

import { useTransition } from "react";
import { HandCoins, Loader2, Star } from "lucide-react";
import { toast } from "sonner";

import { acceptBidAction } from "@/app/(dashboard)/pazaryeri/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SupplierScorecard } from "@/core/scorecard/scorecard-service";

type Bid = {
  id: string;
  price: number;
  message: string | null;
  supplierCompany: { name: string };
  scorecard: SupplierScorecard;
};

/** Only rendered while the shipment is still unassigned (supplierCompanyId null) — see shipments/[id]/page.tsx. */
export function BidListCard({
  shipmentId,
  bids,
}: {
  shipmentId: string;
  bids: Bid[];
}) {
  const [isPending, startTransition] = useTransition();

  function handleAccept(bidId: string, price: number) {
    if (
      !confirm(
        `${price.toLocaleString("tr-TR")} ₺ teklifini kabul etmek istediğinize emin misiniz? Diğer teklifler otomatik reddedilecek.`
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await acceptBidAction(shipmentId, bidId);
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <HandCoins className="text-muted-foreground size-4" />
          Gelen Teklifler
        </CardTitle>
        <Badge variant="secondary">{bids.length}</Badge>
      </CardHeader>
      <CardContent>
        {bids.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            Bu sefer pazarda açık — henüz teklif gelmedi.
          </p>
        ) : (
          <div className="flex flex-col divide-y">
            {bids.map((bid) => (
              <div
                key={bid.id}
                className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <p className="text-sm font-medium">{bid.supplierCompany.name}</p>
                  <p className="text-lg font-semibold">
                    {bid.price.toLocaleString("tr-TR")} ₺
                  </p>
                  {bid.message && (
                    <p className="text-muted-foreground text-xs">{bid.message}</p>
                  )}
                  <div className="text-muted-foreground mt-1 flex items-center gap-3 text-xs">
                    {bid.scorecard.averageRating !== null && (
                      <span className="flex items-center gap-1">
                        <Star className="size-3 fill-yellow-400 text-yellow-400" />
                        {bid.scorecard.averageRating.toFixed(1)} (
                        {bid.scorecard.ratingCount})
                      </span>
                    )}
                    {bid.scorecard.onTimePickupRate !== null && (
                      <span>
                        Zamanında: %
                        {Math.round(bid.scorecard.onTimePickupRate * 100)}
                      </span>
                    )}
                    <span>{bid.scorecard.completedShipmentCount} tamamlanan sefer</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  disabled={isPending}
                  onClick={() => handleAccept(bid.id, bid.price)}
                >
                  {isPending && <Loader2 className="animate-spin" />}
                  Kabul Et
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
