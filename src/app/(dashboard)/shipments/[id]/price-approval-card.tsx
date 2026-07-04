"use client";

import { useTransition } from "react";
import { CircleCheck, CircleX, Clock, Loader2 } from "lucide-react";
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

  const isProposer = companyType === priceProposedBy;

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
      <CardHeader>
        <CardTitle>Nakliye Fiyatı</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-2xl font-semibold tracking-tight">
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
              {!isProposer && !priceRejectedAt &&
                "Karşı tarafın teklif ettiği fiyat."}
              {!isProposer && priceRejectedAt &&
                "Bu teklifi reddettiniz, karşı tarafın yeni teklif girmesini bekliyor."}
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

        {!priceApprovedAt && !isProposer && !priceRejectedAt && (
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
