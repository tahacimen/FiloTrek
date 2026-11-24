"use client";

import { useMemo, useState, useTransition } from "react";
import {
  CalendarClock,
  HandCoins,
  Loader2,
  Star,
  Timer,
  TrendingDown,
} from "lucide-react";
import { toast } from "sonner";

import { acceptBidAction } from "@/app/(dashboard)/pazaryeri/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { bidExpired } from "@/lib/bid";
import { BidCountdown } from "@/components/bid-countdown";
import type { SupplierScorecard } from "@/core/scorecard/scorecard-service";

type Bid = {
  id: string;
  price: number;
  message: string | null;
  transitDays: number | null;
  validUntil: string | null;
  supplierCompany: { name: string };
  scorecard: SupplierScorecard;
};

type SortKey = "price" | "transit" | "rating";

const dateFmt = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" });

/** Only rendered while the shipment is still unassigned (supplierCompanyId null) — see shipments/[id]/page.tsx. */
export function BidListCard({
  shipmentId,
  bids,
  biddingDeadline,
}: {
  shipmentId: string;
  bids: Bid[];
  biddingDeadline?: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [sortKey, setSortKey] = useState<SortKey>("price");

  // Highlights computed over all bids (not just the sorted view).
  const lowestPrice = useMemo(
    () => (bids.length ? Math.min(...bids.map((b) => b.price)) : null),
    [bids]
  );
  const fastestTransit = useMemo(() => {
    const ts = bids
      .map((b) => b.transitDays)
      .filter((d): d is number => d != null);
    return ts.length ? Math.min(...ts) : null;
  }, [bids]);

  const sorted = useMemo(() => {
    const copy = [...bids];
    copy.sort((a, b) => {
      if (sortKey === "price") return a.price - b.price;
      if (sortKey === "transit") {
        // Nulls last.
        const av = a.transitDays ?? Number.POSITIVE_INFINITY;
        const bv = b.transitDays ?? Number.POSITIVE_INFINITY;
        return av - bv;
      }
      // rating desc (nulls last)
      const ar = a.scorecard.averageRating ?? -1;
      const br = b.scorecard.averageRating ?? -1;
      return br - ar;
    });
    return copy;
  }, [bids, sortKey]);

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
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <HandCoins className="text-muted-foreground size-4" />
          Gelen Teklifler
          <Badge variant="secondary">{bids.length}</Badge>
          {biddingDeadline && (
            <BidCountdown deadline={biddingDeadline} className="ml-1" />
          )}
        </CardTitle>
        {bids.length > 1 && (
          <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
            <SelectTrigger className="h-8 w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="price">En düşük fiyat</SelectItem>
              <SelectItem value="transit">En hızlı transit</SelectItem>
              <SelectItem value="rating">En yüksek puan</SelectItem>
            </SelectContent>
          </Select>
        )}
      </CardHeader>
      <CardContent>
        {bids.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            Bu sefer pazarda açık — henüz teklif gelmedi.
          </p>
        ) : (
          <div className="flex flex-col divide-y">
            {sorted.map((bid) => {
              const isLowest = bid.price === lowestPrice;
              const isFastest =
                bid.transitDays != null && bid.transitDays === fastestTransit;
              const expired = bidExpired(
                bid.validUntil ? new Date(bid.validUntil) : null
              );
              return (
                <div
                  key={bid.id}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-sm font-medium">
                        {bid.supplierCompany.name}
                      </p>
                      {isLowest && (
                        <Badge variant="success" className="gap-1 text-[11px]">
                          <TrendingDown className="size-3" />
                          En düşük
                        </Badge>
                      )}
                      {isFastest && (
                        <Badge variant="default" className="gap-1 text-[11px]">
                          <Timer className="size-3" />
                          En hızlı
                        </Badge>
                      )}
                      {expired && (
                        <Badge variant="destructive" className="text-[11px]">
                          Süresi doldu
                        </Badge>
                      )}
                    </div>
                    <p className="text-lg font-semibold">
                      {bid.price.toLocaleString("tr-TR")} ₺
                    </p>
                    <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                      {bid.transitDays != null && (
                        <span className="flex items-center gap-1">
                          <Timer className="size-3" />
                          {bid.transitDays} gün transit
                        </span>
                      )}
                      {bid.validUntil && (
                        <span className="flex items-center gap-1">
                          <CalendarClock className="size-3" />
                          Geçerlilik: {dateFmt.format(new Date(bid.validUntil))}
                        </span>
                      )}
                    </div>
                    {bid.message && (
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {bid.message}
                      </p>
                    )}
                    <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-3 text-xs">
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
                      <span>
                        {bid.scorecard.completedShipmentCount} tamamlanan sefer
                      </span>
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
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
