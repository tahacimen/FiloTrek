"use client";

import { useTransition } from "react";
import { CircleCheck, CircleX, Clock, HandCoins, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { approvePriceAction } from "@/app/(dashboard)/shipments/actions";
import { PriceOfferDialog } from "@/app/(dashboard)/shipments/[id]/price-offer-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Hidden until a price has actually been proposed (set at assignment time)
 * — there's nothing to show or approve before that. The negotiation state
 * lives entirely on the shipment row (agreedPrice/priceProposedBy/
 * priceApprovedAt/priceRejectedAt — see the schema comment) rather than an
 * offer-history table, so the four fields below are the whole state
 * machine: whoever ISN'T priceProposedBy can approve or reject the current
 * amount; a rejection with no counter-price just flags priceRejectedAt and
 * hands the turn back to the original proposer.
 */
export function PriceApprovalCard({
  shipmentId,
  companyType,
  agreedPrice,
  priceProposedBy,
  priceApprovedAt,
  priceRejectedAt,
}: {
  shipmentId: string;
  companyType: "SUPPLIER" | "CUSTOMER";
  agreedPrice: number | null;
  priceProposedBy: "SUPPLIER" | "CUSTOMER" | null;
  priceApprovedAt: Date | null;
  priceRejectedAt: Date | null;
}) {
  const [isPending, startTransition] = useTransition();

  if (agreedPrice === null) return null;
  const confirmedPrice = agreedPrice;

  // priceProposedBy should never be null while agreedPrice is set (every
  // real code path that sets a price sets this together — see the schema
  // comment on Shipment.priceProposedBy), but treating null as "neither
  // side" here rather than falling through to the `!isProposer` branch
  // matters: `companyType === null` is false for both SUPPLIER and
  // CUSTOMER, so a naive isProposer check would show the approve/reject
  // actions to BOTH sides at once if this ever happened.
  const isProposer = priceProposedBy !== null && companyType === priceProposedBy;
  const isCounterparty = priceProposedBy !== null && companyType !== priceProposedBy;

  function handleApprove() {
    if (
      !confirm(
        `${confirmedPrice.toLocaleString("tr-TR")} ₺ fiyatını onaylamak istediğinize emin misiniz?`
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await approvePriceAction(shipmentId);
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <HandCoins className="text-muted-foreground size-4" />
          Fiyat Pazarlığı
        </CardTitle>
        <Badge variant={priceApprovedAt ? "outline" : "secondary"}>
          {priceApprovedAt ? "Kapalı" : "Açık"}
        </Badge>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs">Güncel Teklif</span>
          <span className="text-3xl font-extrabold tracking-tight">
            {agreedPrice.toLocaleString("tr-TR")} ₺
          </span>
          {priceApprovedAt ? (
            <Badge variant="success" className="w-fit">
              <CircleCheck />
              Onaylandı
            </Badge>
          ) : priceRejectedAt ? (
            <Badge variant="destructive" className="w-fit">
              <CircleX />
              Reddedildi
            </Badge>
          ) : (
            <Badge variant="warning" className="w-fit">
              <Clock />
              Onay Bekliyor
            </Badge>
          )}
          {!priceApprovedAt && (
            <span className="text-muted-foreground text-xs">
              {isProposer && !priceRejectedAt &&
                "Karşı tarafın teklifiniz için yanıtı bekleniyor."}
              {isProposer && priceRejectedAt &&
                "Teklifiniz reddedildi — yeni bir fiyat girebilirsiniz."}
              {isCounterparty && !priceRejectedAt &&
                "Karşı tarafın teklif ettiği fiyat."}
              {isCounterparty && priceRejectedAt &&
                "Bu teklifi reddettiniz, karşı tarafın yeni teklif girmesini bekliyor."}
              {!isProposer && !isCounterparty &&
                "Fiyat teklifi eksik bilgiyle kaydedilmiş — lütfen destek ile iletişime geçin."}
            </span>
          )}
        </div>

        {!priceApprovedAt && isProposer && (
          <PriceOfferDialog
            shipmentId={shipmentId}
            mode="propose"
            triggerLabel={priceRejectedAt ? "Yeni Fiyat Öner" : "Teklifi Güncelle"}
            triggerVariant={priceRejectedAt ? "default" : "outline"}
          />
        )}

        {!priceApprovedAt && isCounterparty && !priceRejectedAt && (
          <div className="flex items-center gap-2">
            <Button onClick={handleApprove} disabled={isPending}>
              {isPending && <Loader2 className="animate-spin" />}
              Fiyatı Onayla
            </Button>
            <PriceOfferDialog
              shipmentId={shipmentId}
              mode="reject"
              triggerLabel="Reddet"
              triggerVariant="outline"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
